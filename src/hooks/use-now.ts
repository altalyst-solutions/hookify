import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/** Options for {@link useNow}. */
export interface UseNowOptions {
  /**
   * How often, in milliseconds, the time is refreshed. A value that is not a
   * finite, positive number falls back to the default, and values above
   * `2147483647` are capped. Default is `1000`.
   */
  intervalMs?: number;
  /**
   * Set to `false` to stop updating. The hook then returns the last value it
   * returned while enabled, or the time of its first render if it starts
   * disabled. Default is `true`.
   */
  enabled?: boolean;
  /**
   * Stop ticking while the document is hidden, and refresh as soon as it is
   * visible again. Consumers with different values use separate timers.
   * Default is `true`.
   */
  pauseWhenHidden?: boolean;
  /**
   * The time, in milliseconds since the epoch, to return on the server and
   * while hydrating. Pass a timestamp serialized by the server to get
   * identical markup on both sides. Default is the current time.
   */
  serverNow?: number;
}

/**
 * A ticker shared by every {@link useNow} consumer with the same interval and
 * visibility behavior.
 */
interface Clock {
  /** The most recent time, in milliseconds since the epoch. */
  value: number;
  /** The `useSyncExternalStore` callbacks of the consumers subscribed to this clock. */
  listeners: Set<() => void>;
  /** The running interval, or `undefined` while paused because the document is hidden. */
  timer: ReturnType<typeof setInterval> | undefined;
  /** Stops the timer and removes the visibility listener. */
  destroy: () => void;
}

/** The interval used when `intervalMs` is not given or not usable, in milliseconds. */
const DEFAULT_INTERVAL_MS = 1000;
/** The longest delay `setInterval` supports, in milliseconds. Larger values fire immediately. */
const MAX_INTERVAL_MS = 2 ** 31 - 1;
/**
 * The longest a time read without a running clock is reused, in milliseconds.
 * `useSyncExternalStore` needs the same value from repeated reads, so the time
 * is cached briefly instead of calling `Date.now()` every time.
 */
const MAX_IDLE_AGE_MS = 1000;

/** The clocks that currently have at least one subscriber, keyed by interval and visibility behavior. */
const clocks = new Map<string, Clock>();

/** The time last read by {@link readIdle}. */
let idleValue = 0;
/** When {@link readIdle} last refreshed `idleValue`. */
let idleReadAt = -Infinity;

/**
 * Reads the time for a consumer that is not backed by a running clock: before
 * it subscribes, while it is disabled, or while the document is hidden.
 *
 * @param intervalMs - The consumer's interval; the cached time is never older than this.
 * @returns The current time, at most `MAX_IDLE_AGE_MS` old.
 */
const readIdle = (intervalMs: number): number => {
  const now = Date.now();
  const age = now - idleReadAt;
  // A negative age means the system clock went backwards.
  if (age >= Math.min(intervalMs, MAX_IDLE_AGE_MS) || age < 0) {
    idleValue = now;
    idleReadAt = now;
  }
  return idleValue;
};

/**
 * Normalizes `intervalMs` to a delay that is safe to pass to `setInterval`.
 *
 * @param intervalMs - The requested interval.
 * @returns A finite, positive delay.
 */
const normalizeInterval = (intervalMs: number): number =>
  Number.isFinite(intervalMs) && intervalMs > 0
    ? Math.min(intervalMs, MAX_INTERVAL_MS)
    : DEFAULT_INTERVAL_MS;

/**
 * Refreshes a clock's value and tells its subscribers.
 *
 * @param clock - The clock to advance.
 */
const tick = (clock: Clock): void => {
  clock.value = Date.now();
  clock.listeners.forEach((listener) => listener());
};

/**
 * Creates a clock that ticks every `intervalMs`, and pauses while the document
 * is hidden when `pauseWhenHidden` is set.
 *
 * @param intervalMs - The tick interval, already normalized.
 * @param pauseWhenHidden - Whether the clock pauses while the document is hidden.
 * @returns The clock, already running unless the document is hidden.
 */
const createClock = (intervalMs: number, pauseWhenHidden: boolean): Clock => {
  /** Starts the interval that advances the clock. */
  const start = () => {
    clock.timer = setInterval(() => tick(clock), intervalMs);
  };

  /** Stops the interval, so nothing ticks until `start` runs again. */
  const stop = () => {
    clearInterval(clock.timer);
    clock.timer = undefined;
  };

  /** Pauses while the document is hidden, and refreshes and resumes when it is visible. */
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      stop();
    } else if (clock.timer === undefined) {
      tick(clock);
      start();
    }
  };

  const clock: Clock = {
    value: readIdle(intervalMs),
    listeners: new Set(),
    timer: undefined,
    destroy: () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };

  if (!pauseWhenHidden || document.visibilityState !== "hidden") {
    start();
  }
  if (pauseWhenHidden) {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  return clock;
};

/**
 * Subscribes to the shared clock for an interval, creating it for the first
 * subscriber and destroying it with the last.
 *
 * @param key - The key of the clock in the registry.
 * @param intervalMs - The tick interval, already normalized.
 * @param pauseWhenHidden - Whether the clock pauses while the document is hidden.
 * @param listener - Called whenever the clock ticks.
 * @returns A function that removes the subscription.
 */
const subscribeToClock = (
  key: string,
  intervalMs: number,
  pauseWhenHidden: boolean,
  listener: () => void
): (() => void) => {
  const clock = clocks.get(key) ?? createClock(intervalMs, pauseWhenHidden);
  clocks.set(key, clock);
  clock.listeners.add(listener);

  return () => {
    clock.listeners.delete(listener);
    if (clock.listeners.size === 0) {
      clock.destroy();
      clocks.delete(key);
    }
  };
};

/**
 * Subscribes to nothing, for a consumer that is disabled.
 *
 * @returns A function that does nothing.
 */
const subscribeToNothing = (): (() => void) => () => undefined;

/**
 * A custom React hook that returns the current time in milliseconds and
 * re-renders the component at a fixed interval.
 *
 * Every component that uses the same `intervalMs` shares one timer, so
 * hundreds of "5 minutes ago" labels cost a single `setInterval`. The timer
 * starts with the first subscriber and stops with the last. The hook is built
 * on `useSyncExternalStore`, so every component in a render sees the same
 * value and updates never tear under concurrent rendering.
 *
 * By default ticks stop while the tab is hidden, and the value refreshes as
 * soon as the tab is visible again. Pass `enabled: false` to stop updating, for
 * example to pause a stopwatch: the hook keeps returning the last value it
 * returned while enabled.
 *
 * The result is a plain number, so you can derive anything from it: wrap it
 * in `new Date(now)`, add a server clock offset, or compute a remaining time.
 * To limit re-renders, pick an interval as coarse as your UI needs (one
 * minute for relative labels, one second for countdowns). The value can be up
 * to one interval older than a `Date.now()` you read yourself, so clamp
 * differences that must not be negative.
 *
 * On the server, and while hydrating, the hook returns `serverNow` when given,
 * and the current time otherwise. Time-dependent text then differs from the
 * server's HTML unless you pass the same `serverNow` on both sides (for
 * example a timestamp from props) or use `suppressHydrationWarning`.
 *
 * @param options - Optional interval, pause and server-time settings.
 * @returns The current time in milliseconds since the epoch, as `Date.now()` returns.
 *
 * @example
 * ```tsx
 * const RelativeTime = ({ date }: { date: number }) => {
 *   const now = useNow({ intervalMs: 60_000 });
 *   const minutes = Math.max(0, Math.round((now - date) / 60_000));
 *   return <span>{minutes} min ago</span>;
 * };
 * ```
 *
 * @example
 * ```tsx
 * // Countdown that stops once the deadline passes
 * const now = useNow({ enabled: now < deadline });
 * ```
 *
 * @example
 * ```tsx
 * // Same markup on the server and in the browser
 * const now = useNow({ serverNow: props.renderedAt });
 * ```
 *
 * For a live, editable example, see the [useNow docs page](https://altalyst-solutions.github.io/hookify/hooks/use-now).
 */
export const useNow = (options?: UseNowOptions): number => {
  const enabled = options?.enabled ?? true;
  const pauseWhenHidden = options?.pauseWhenHidden ?? true;
  const intervalMs = normalizeInterval(
    options?.intervalMs ?? DEFAULT_INTERVAL_MS
  );
  const serverNow = options?.serverNow;
  /** Consumers with the same key share one clock. */
  const key = `${intervalMs}:${pauseWhenHidden}`;

  /** Joins the shared clock, or nothing while disabled. Memoized so React does not resubscribe on every render. */
  const subscribe = useCallback(
    (listener: () => void) =>
      enabled
        ? subscribeToClock(key, intervalMs, pauseWhenHidden, listener)
        : subscribeToNothing(),
    [enabled, key, intervalMs, pauseWhenHidden]
  );
  /** Reads the running clock, or a briefly cached time when there is none. */
  const getSnapshot = useCallback(() => {
    const clock = enabled ? clocks.get(key) : undefined;
    return clock && clock.timer !== undefined
      ? clock.value
      : readIdle(intervalMs);
  }, [enabled, key, intervalMs]);
  /** Reads the time used on the server and while hydrating. */
  const getServerSnapshot = useCallback(
    () => serverNow ?? readIdle(intervalMs),
    [serverNow, intervalMs]
  );

  /** The current time. While disabled it is not returned, see `lastEnabledRef`. */
  const live = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /** The last time this consumer saw while enabled, returned while disabled. */
  const lastEnabledRef = useRef(live);
  useEffect(() => {
    if (enabled) {
      lastEnabledRef.current = live;
    }
  }, [enabled, live]);

  // The ref is written after commit, like `usePrevious`, so it only holds a
  // value from an earlier render. State would re-render on every tick instead.
  // eslint-disable-next-line react-hooks/refs
  return enabled ? live : lastEnabledRef.current;
};
