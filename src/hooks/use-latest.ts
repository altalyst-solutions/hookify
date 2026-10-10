import { type RefObject, useEffect, useRef } from "react";

/**
 * Returns a ref that always holds the latest value passed to the hook.
 *
 * Useful for reading up-to-date props, state or callbacks from long-lived
 * closures (timers, event listeners, async callbacks, effects with empty
 * dependency arrays) without re-subscribing or capturing stale values.
 *
 * The ref is synchronized in an effect, so it is updated after each commit
 * rather than during render. Read `ref.current` inside callbacks or effects,
 * not while rendering.
 *
 * @param value - The value to keep in the ref.
 * @returns A stable ref object whose `current` is the latest value.
 *
 * @example
 * ```ts
 * const onTickRef = useLatest(onTick);
 *
 * useEffect(() => {
 *   const id = setInterval(() => onTickRef.current(), 1000);
 *   return () => clearInterval(id);
 * }, [onTickRef]);
 * ```
 */
export const useLatest = <T>(value: T): RefObject<T> => {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  });

  return ref;
};
