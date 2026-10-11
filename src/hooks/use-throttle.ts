import { useEffect, useRef, useState } from "react";

import { useLatest } from "./use-latest";

/** Options for {@link useThrottle}. */
export interface UseThrottleOptions {
  /** Emit a change immediately when no throttle window is active. Default is `true`. */
  leading?: boolean;
  /** Emit the latest value received during a window when it ends. Default is `true`. */
  trailing?: boolean;
}

/**
 * Returns a throttled copy of `value` that updates at most once per `delay`
 * milliseconds. It is the value-based counterpart to `useDebounce`.
 *
 * A throttle window starts when a change arrives while none is active. With
 * `leading` (default) the change is emitted immediately; with `trailing`
 * (default) the latest value seen during the window is emitted when it ends,
 * which starts a new window. The initial value is returned as-is on the first
 * render. With both options `false`, the returned value never updates.
 * Pending timers are cleared on unmount.
 *
 * @typeParam T - The type of the value to throttle.
 * @param value - The value to throttle.
 * @param delay - The minimum interval between updates, in milliseconds.
 * @param options - Optional {@link UseThrottleOptions | leading/trailing} behavior.
 * @returns The throttled value.
 *
 * @example
 * ```tsx
 * const [scrollY, setScrollY] = useState(0);
 * const throttledScrollY = useThrottle(scrollY, 200);
 * ```
 *
 * @example
 * ```tsx
 * // Only emit at the end of each window
 * const throttledQuery = useThrottle(query, 500, { leading: false });
 * ```
 *
 * For a live, editable example, see the [useThrottle docs page](https://altalyst-solutions.github.io/hookify/hooks/use-throttle).
 */
export const useThrottle = <T>(
  value: T,
  delay: number,
  options?: UseThrottleOptions
): T => {
  const [throttled, setThrottled] = useState(value);
  const optionsRef = useLatest({
    leading: options?.leading ?? true,
    trailing: options?.trailing ?? true,
    delay,
  });
  const emittedRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ value: T } | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      pendingRef.current = { value };
      return;
    }
    if (Object.is(value, emittedRef.current)) return;

    const emit = (next: T) => {
      emittedRef.current = next;
      setThrottled(next);
    };

    const startWindow = () => {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending && optionsRef.current.trailing) {
          emit(pending.value);
          startWindow();
        }
      }, optionsRef.current.delay);
    };

    if (optionsRef.current.leading) {
      emit(value);
    } else {
      pendingRef.current = { value };
    }
    startWindow();
  }, [value, optionsRef]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    },
    []
  );

  return throttled;
};
