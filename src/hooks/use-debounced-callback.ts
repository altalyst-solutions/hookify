import { useEffect, useState } from "react";

import { useLatest } from "./use-latest";

/** Options for {@link useDebouncedCallback}. */
export interface UseDebouncedCallbackOptions {
  /** Invoke the callback immediately when a burst of calls starts. Default is `false`. */
  leading?: boolean;
  /** Invoke the callback with the latest arguments once the calls pause. Default is `true`. */
  trailing?: boolean;
  /** Invoke any pending call (instead of discarding it) when the component unmounts. Default is `false`. */
  flushOnUnmount?: boolean;
}

/**
 * A debounced function returned by {@link useDebouncedCallback}, with controls
 * to manage the pending call.
 *
 * @typeParam T - The type of the callback that was debounced.
 */
export interface DebouncedFunction<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see `useDebouncedCallback`.
  T extends (...args: any[]) => void,
> {
  (...args: Parameters<T>): void;
  /** Discard the pending call, if any. */
  cancel: () => void;
  /** Invoke the pending call immediately, if any. */
  flush: () => void;
  /** Whether a call is currently waiting to be invoked. */
  isPending: () => boolean;
}

/**
 * Returns a stable, debounced version of `callback` that is only invoked once
 * `delay` milliseconds have passed since its last call, along with `cancel`,
 * `flush` and `isPending` controls.
 *
 * Unlike `useDebounce`, the returned function keeps the same identity for the
 * lifetime of the component and always invokes the latest `callback` and
 * `delay`, so it is safe in dependency arrays and long-lived listeners. A new
 * `delay` applies from the next call; a pending timer is not rescheduled.
 *
 * By default the callback runs on the trailing edge with the latest arguments.
 * With `leading`, the first call of a burst runs immediately; with both
 * `leading` and `trailing`, a trailing call only follows when there were
 * further calls during the burst. With both set to `false` the callback is
 * never invoked. The return value of `callback` is ignored. A pending call is
 * discarded on unmount, or flushed when `flushOnUnmount` is set. For
 * rate-limiting a continuously changing value, see `useThrottle`.
 *
 * @typeParam T - The type of the callback function to debounce.
 * @param callback - The function to debounce.
 * @param delay - The debounce delay in milliseconds.
 * @param options - Optional {@link UseDebouncedCallbackOptions | leading/trailing and unmount} behavior.
 * @returns A {@link DebouncedFunction | debounced function} with `cancel`, `flush` and `isPending`.
 *
 * @example
 * ```tsx
 * const search = useDebouncedCallback((query: string) => {
 *   fetchResults(query);
 * }, 300);
 *
 * return <input onChange={(e) => search(e.target.value)} />;
 * ```
 *
 * @example
 * ```tsx
 * // Autosave, flushing on blur and on unmount
 * const save = useDebouncedCallback(saveDraft, 1000, { flushOnUnmount: true });
 *
 * return (
 *   <textarea onChange={(e) => save(e.target.value)} onBlur={save.flush} />
 * );
 * ```
 *
 * @example
 * ```tsx
 * // Ignore rapid repeat clicks, running only the first
 * const submit = useDebouncedCallback(sendForm, 1000, {
 *   leading: true,
 *   trailing: false,
 * });
 * ```
 *
 * For a live, editable example, see the [useDebouncedCallback docs page](https://altalyst-solutions.github.io/hookify/hooks/use-debounced-callback).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- `any[]` is required here (not `unknown[]`) so narrower callback signatures remain assignable to `T`, matching the pattern used by TS's own `Parameters<T>`.
export const useDebouncedCallback = <T extends (...args: any[]) => void>(
  callback: T,
  delay: number,
  options?: UseDebouncedCallbackOptions
): DebouncedFunction<T> => {
  const latest = useLatest({
    callback,
    delay,
    leading: options?.leading ?? false,
    trailing: options?.trailing ?? true,
    flushOnUnmount: options?.flushOnUnmount ?? false,
  });

  const [debounced] = useState(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendingArgs: { args: Parameters<T> } | null = null;

    const takePending = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      const pending = pendingArgs;
      pendingArgs = null;
      return pending;
    };

    const fn = ((...args: Parameters<T>) => {
      const { leading, trailing, delay } = latest.current;
      const isIdle = timer === null;
      if (timer !== null) clearTimeout(timer);

      const runNow = isIdle && leading;
      pendingArgs = !runNow && trailing ? { args } : null;
      timer = setTimeout(() => {
        const pending = takePending();
        if (pending) latest.current.callback(...pending.args);
      }, delay);

      if (runNow) latest.current.callback(...args);
    }) as DebouncedFunction<T>;

    fn.cancel = () => {
      takePending();
    };
    fn.flush = () => {
      const pending = takePending();
      if (pending) latest.current.callback(...pending.args);
    };
    fn.isPending = () => pendingArgs !== null;

    return fn;
  });

  useEffect(
    () => () => {
      if (latest.current.flushOnUnmount) debounced.flush();
      else debounced.cancel();
    },
    [debounced, latest]
  );

  return debounced;
};
