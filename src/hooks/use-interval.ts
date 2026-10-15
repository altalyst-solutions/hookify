import { useEffect } from "react";

import { useLatest } from "./use-latest";

/** Options for {@link useInterval}. */
export interface UseIntervalOptions {
  /** Also invoke the callback once as soon as the interval starts. Default is `false`. */
  immediate?: boolean;
}

/**
 * Declarative `setInterval`. Calls `callback` every `delay` milliseconds while
 * `delay` is a number, and pauses while it is `null`.
 *
 * The latest `callback` is always used, so changing it (for example because it
 * closes over state) never resets the timer. Changing `delay`, or switching it
 * between `null` and a number, restarts the interval. The interval is cleared
 * on unmount.
 *
 * With `immediate`, the callback also runs once whenever the interval starts:
 * on mount, when resuming from `null`, and when `delay` changes. Under React
 * `StrictMode` in development this means an extra call, like any effect.
 *
 * @param callback - The function to call on every tick.
 * @param delay - The interval in milliseconds, or `null` to pause.
 * @param options - Optional {@link UseIntervalOptions | behavior} flags.
 *
 * @example
 * ```tsx
 * const [count, setCount] = useState(0);
 * useInterval(() => setCount((c) => c + 1), 1000);
 * ```
 *
 * @example
 * ```tsx
 * // Pause and resume by toggling the delay
 * const [running, setRunning] = useState(true);
 * useInterval(poll, running ? 5000 : null, { immediate: true });
 * ```
 *
 * For a live, editable example, see the [useInterval docs page](https://altalyst-solutions.github.io/hookify/hooks/use-interval).
 */
export const useInterval = (
  callback: () => void,
  delay: number | null,
  options?: UseIntervalOptions
): void => {
  const callbackRef = useLatest(callback);
  const immediateRef = useLatest(options?.immediate ?? false);

  useEffect(() => {
    if (delay === null) return;

    if (immediateRef.current) callbackRef.current();
    const id = setInterval(() => callbackRef.current(), delay);
    return () => clearInterval(id);
  }, [delay, callbackRef, immediateRef]);
};
