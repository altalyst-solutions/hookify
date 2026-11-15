import { useEffect, useState } from "react";

import { useLatest } from "./use-latest";

/** The longest delay `setTimeout` supports, in milliseconds. Larger values fire immediately. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
/** Absorbs floating point error, so a token that is 0.9999999 full counts as a whole one. */
const EPSILON = 1e-9;

/** Options for {@link useRateLimitedCallback}. */
export interface UseRateLimitedCallbackOptions<
  A extends unknown[] = unknown[],
> {
  /**
   * The most calls that may run within `windowMs`, and the size of a burst. It
   * is rounded down; a value below `1` means no call ever runs.
   */
  limit: number;
  /**
   * The window, in milliseconds, over which `limit` calls are allowed. Tokens
   * refill smoothly at `limit / windowMs` per millisecond. `0` or less means no
   * limit.
   */
  windowMs: number;
  /**
   * What to do with a call that arrives when no token is left: `"drop"`
   * discards it, `"queue"` runs it, in order, as tokens refill. Default is
   * `"drop"`.
   */
  overflow?: "drop" | "queue";
  /**
   * The most calls kept waiting when `overflow` is `"queue"`. A call that
   * finds the queue full is dropped. Default is `Infinity`.
   */
  maxQueue?: number;
  /**
   * Called synchronously with the arguments of every call that is dropped:
   * none left in `"drop"` mode, or a full queue in `"queue"` mode. Not called
   * when a queued call is discarded by `cancel` or on unmount.
   */
  onLimited?: (...args: A) => void;
}

/**
 * A rate-limited function returned by {@link useRateLimitedCallback}, with
 * controls to inspect and clear the limiter.
 *
 * @typeParam A - The argument list of the limited callback.
 */
export interface RateLimitedFunction<A extends unknown[]> {
  /**
   * Calls the callback if a token is left, otherwise drops or queues the call.
   *
   * @returns `true` if the call ran now or was added to the queue, `false` if
   * it was dropped.
   */
  (...args: A): boolean;
  /** Discard every queued call. Tokens already spent are not refunded. */
  cancel: () => void;
  /** The whole number of calls that would run right now. */
  remaining: () => number;
  /** The number of calls waiting in the queue. */
  pending: () => number;
}

/**
 * Returns a stable function that runs `callback` at most `limit` times per
 * `windowMs`, using a token bucket.
 *
 * The bucket starts full, so up to `limit` calls run immediately as a burst.
 * Each call spends a token, and tokens refill smoothly at `limit / windowMs`
 * per millisecond, up to `limit`. This sets it apart from
 * `useDebouncedCallback` (waits for a quiet period) and `useThrottledValue`
 * (one update per interval): bursts are allowed, but the average rate is not.
 *
 * When no token is left, the call is dropped (default) or, with
 * `overflow: "queue"`, queued and run in order as tokens refill, up to
 * `maxQueue`. The returned function reports whether a call ran or was queued
 * (`true`) or dropped (`false`), and `onLimited` receives the dropped
 * arguments. Use `remaining` and `pending` to read the limiter's state, and
 * `cancel` to empty the queue. They read the current state and do not
 * re-render your component.
 *
 * The returned function keeps the same identity for the lifetime of the
 * component and always runs the latest `callback` and options, so it is safe
 * in dependency arrays and long-lived listeners. A new `limit` or `windowMs`
 * applies from the next call or refill, without resetting spent tokens. The
 * return value of `callback` is ignored. On unmount the queue and timer are
 * cleared and later calls are ignored (they return `false`), so nothing runs
 * after unmount.
 *
 * @typeParam A - The argument list of the callback.
 * @param callback - The function to limit.
 * @param options - The {@link UseRateLimitedCallbackOptions | limit, window and overflow} behavior.
 * @returns A {@link RateLimitedFunction | rate-limited function} with `cancel`, `remaining` and `pending`.
 *
 * @example
 * ```tsx
 * // At most 5 searches every 10 seconds, extra ones are dropped
 * const search = useRateLimitedCallback(
 *   (query: string) => fetchResults(query),
 *   {
 *     limit: 5,
 *     windowMs: 10_000,
 *     onLimited: () => toast("Slow down a little"),
 *   }
 * );
 *
 * return <input onChange={(e) => search(e.target.value)} />;
 * ```
 *
 * @example
 * ```tsx
 * // Send events in order, at most 2 per second, holding up to 50 back
 * const track = useRateLimitedCallback(sendEvent, {
 *   limit: 2,
 *   windowMs: 1000,
 *   overflow: "queue",
 *   maxQueue: 50,
 * });
 * ```
 *
 * For a live, editable example, see the [useRateLimitedCallback docs page](https://altalyst-solutions.github.io/hookify/hooks/use-rate-limited-callback).
 */
export const useRateLimitedCallback = <A extends unknown[]>(
  callback: (...args: A) => void,
  options: UseRateLimitedCallbackOptions<A>
): RateLimitedFunction<A> => {
  /** Refs to the latest callback and options, so changing them never resets the limiter. */
  const latest = useLatest({ callback, options });

  // The limiter lives outside React state: it is created once per component and
  // never causes a re-render, which keeps the returned function stable.
  const [limited] = useState(() => {
    /**
     * The tokens in the bucket. It is fractional, because tokens refill
     * continuously. `null` means the bucket was never used, so it is full at
     * whatever `limit` is by then.
     */
    let tokens: number | null = null;
    /** When `tokens` was last brought up to date, from a monotonic clock. */
    let refilledAt = performance.now();
    /** The timer that runs the next queued call, if any call is waiting. */
    let timer: ReturnType<typeof setTimeout> | null = null;
    /** `true` once the component has unmounted, so later calls are ignored. */
    let disposed = false;
    /** The arguments of the calls waiting for a token, oldest first. */
    const queue: A[] = [];

    /** The size of the bucket: `limit`, rounded down, and `0` when invalid. */
    const getCapacity = () => {
      const { limit } = latest.current.options;
      return Number.isNaN(limit) ? 0 : Math.max(0, Math.floor(limit));
    };

    /**
     * Adds the tokens earned since the last refill, up to the capacity, using
     * the latest options. Tokens are computed on demand from the elapsed time,
     * so there is no timer ticking while nobody is calling.
     *
     * @returns The tokens in the bucket.
     */
    const refill = () => {
      const { windowMs } = latest.current.options;
      const capacity = getCapacity();
      const now = performance.now();
      const elapsed = now - refilledAt;
      refilledAt = now;

      // Without a usable window there is nothing to wait for, so the bucket is
      // always full.
      if (tokens === null || !(windowMs > 0)) {
        tokens = capacity;
      } else if (elapsed > 0) {
        tokens = Math.min(capacity, tokens + elapsed * (capacity / windowMs));
      } else {
        tokens = Math.min(capacity, tokens);
      }
      return tokens;
    };

    /** Stops the timer that would run the next queued call. */
    const clearTimer = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };

    /** Spends one token. Call `refill` first. */
    const take = () => {
      tokens = (tokens ?? 0) - 1;
    };

    /**
     * Arms one timer for the moment the next token is due, when calls are
     * waiting and none is armed. Doing it per token, rather than on a fixed
     * tick, means an empty queue costs nothing.
     */
    const schedule = () => {
      if (timer !== null || queue.length === 0 || disposed) return;
      const { windowMs } = latest.current.options;
      const rate = getCapacity() / windowMs;
      const wait = (1 - (tokens ?? 0)) / rate;
      // Tokens never come back (a rate of 0), so there is nothing to wait for.
      if (!Number.isFinite(wait)) return;
      timer = setTimeout(
        drain,
        Math.min(Math.ceil(Math.max(wait, 0)), MAX_TIMEOUT_MS)
      );
    };

    /**
     * Runs as many queued calls as there are tokens for, then re-arms the
     * timer for the rest. It re-reads the options each time, so a `limit` or
     * `windowMs` that changed while waiting is respected.
     */
    const drain = () => {
      timer = null;
      // `finally` so a throwing callback can't leave the rest of the queue
      // without a timer.
      try {
        refill();
        while (queue.length > 0 && (tokens ?? 0) >= 1 - EPSILON) {
          take();
          latest.current.callback(...(queue.shift() as A));
        }
      } finally {
        schedule();
      }
    };

    /** The rate-limited function handed to the consumer. */
    const fn = ((...args: A) => {
      if (disposed) return false;

      const {
        overflow = "drop",
        maxQueue = Infinity,
        onLimited,
      } = latest.current.options;
      const available = refill();

      // Run now only if nobody is queued, so calls keep their order.
      if (queue.length === 0 && available >= 1 - EPSILON) {
        take();
        latest.current.callback(...args);
        return true;
      }

      // Queue instead of dropping. A bucket that can never hold a token would
      // keep the call waiting forever, so it is dropped.
      if (
        overflow === "queue" &&
        getCapacity() >= 1 &&
        queue.length < maxQueue
      ) {
        queue.push(args);
        schedule();
        return true;
      }

      onLimited?.(...args);
      return false;
    }) as RateLimitedFunction<A>;

    fn.cancel = () => {
      clearTimer();
      queue.length = 0;
    };
    // The epsilon keeps a token that is 0.9999999 full from reading as `0`.
    fn.remaining = () => Math.max(0, Math.floor(refill() + EPSILON));
    fn.pending = () => queue.length;

    return {
      fn,
      /** Allows calls again. Runs on mount and after StrictMode's simulated unmount. */
      attach: () => {
        disposed = false;
      },
      /** Ignores later calls and discards the queue, so nothing runs after unmount. */
      dispose: () => {
        disposed = true;
        fn.cancel();
      },
    };
  });

  useEffect(() => {
    limited.attach();
    return limited.dispose;
  }, [limited]);

  return limited.fn;
};
