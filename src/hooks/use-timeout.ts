import { useEffect, useState } from "react";

import { useLatest } from "./use-latest";

/** Options for {@link useTimeout}. */
export interface UseTimeoutOptions {
  /**
   * Start the timer automatically on mount, and restart it whenever `delay`
   * changes. Set it to `false` to start the timer yourself with
   * {@link UseTimeoutControls.start}. Default is `true`.
   */
  autoStart?: boolean;
}

/** Controls returned by {@link useTimeout}. They keep the same identity across renders. */
export interface UseTimeoutControls {
  /** Start the timer, or restart it from the full `delay` if it is already running. Does nothing while `delay` is `null`. */
  start: () => void;
  /** Stop the timer without calling the callback. */
  cancel: () => void;
  /** Whether the timer is running and the callback has not been called yet. */
  isPending: () => boolean;
}

/**
 * Declarative `setTimeout`. Calls `callback` once, `delay` milliseconds after
 * mount, and returns `start`, `cancel` and `isPending` controls.
 *
 * The latest `callback` is always used, so changing it (for example because
 * it closes over state) never resets the timer. Changing `delay`, or
 * switching it between `null` and a number, restarts the timer; while `delay`
 * is `null` there is no timer, which is how you pause. The timer is cleared
 * on unmount.
 *
 * Use `start` to restart the countdown, for example on every user action
 * (an inactivity timer) or to show something again after it was dismissed.
 * With `autoStart: false` nothing runs until you call `start`, and a running
 * timer is left alone when `delay` changes; the new `delay` applies the next
 * time `start` is called. The return value of `callback` is ignored. For a
 * recurring timer, see `useInterval`; for delaying a value or a burst of
 * calls, see `useDebounce` and `useDebouncedCallback`.
 *
 * @param callback - The function to call when the timer elapses.
 * @param delay - The delay in milliseconds, or `null` for no timer.
 * @param options - Optional {@link UseTimeoutOptions | behavior} flags.
 * @returns Stable {@link UseTimeoutControls | controls} to `start`, `cancel`
 * and check `isPending` on the timer.
 *
 * @example
 * ```tsx
 * // Auto-dismiss a notice after 3 seconds
 * useTimeout(onDismiss, 3000);
 * ```
 *
 * @example
 * ```tsx
 * // Pause while hovered by switching the delay to null
 * const [hovered, setHovered] = useState(false);
 * useTimeout(onDismiss, hovered ? null : 3000);
 * ```
 *
 * @example
 * ```tsx
 * // Start on demand, restarting the countdown on every click
 * const [saved, setSaved] = useState(false);
 * const { start } = useTimeout(() => setSaved(false), 2000, {
 *   autoStart: false,
 * });
 *
 * const save = () => {
 *   setSaved(true);
 *   start();
 * };
 * ```
 *
 * For a live, editable example, see the [useTimeout docs page](https://altalyst-solutions.github.io/hookify/hooks/use-timeout).
 */
export const useTimeout = (
  callback: () => void,
  delay: number | null,
  options?: UseTimeoutOptions
): UseTimeoutControls => {
  const autoStart = options?.autoStart ?? true;
  const latest = useLatest({ callback, delay });

  const [controls] = useState<UseTimeoutControls>(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cancel = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };

    const start = () => {
      cancel();
      const { delay } = latest.current;
      if (delay === null) return;

      timer = setTimeout(() => {
        timer = null;
        latest.current.callback();
      }, delay);
    };

    return { start, cancel, isPending: () => timer !== null };
  });

  useEffect(() => {
    if (!autoStart) return;

    controls.start();
    return controls.cancel;
  }, [autoStart, delay, controls]);

  useEffect(() => controls.cancel, [controls]);

  return controls;
};
