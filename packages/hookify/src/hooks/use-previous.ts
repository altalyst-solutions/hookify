import { useEffect, useRef } from "react";

/** Options for {@link usePrevious}. */
export interface UsePreviousOptions<T> {
  /** Value returned on the first render, before any previous value exists. */
  initialValue: T;
}

/** Call signatures of {@link usePrevious}. */
export interface UsePrevious {
  <T>(value: T, options: UsePreviousOptions<T>): T;
  <T>(value: T): T | undefined;
}

/**
 * Returns the value passed to the hook on the previous render.
 *
 * Useful for diffing props or state, detecting direction of change, or
 * driving animations. It does not trigger extra re-renders: the value is
 * recorded in a ref after each commit.
 *
 * Without `initialValue` the hook returns `undefined` on the first render.
 * To track a derived value (for example `item.id`) pass that value instead of
 * the whole object. Read the result while rendering or in effects.
 *
 * @param value - The value to track.
 * @param options - Optional settings; `initialValue` is returned on the first render.
 * @returns The value from the previous render.
 *
 * @example
 * ```ts
 * const prevCount = usePrevious(count);
 * const direction = prevCount === undefined || count === prevCount
 *   ? "none"
 *   : count > prevCount ? "up" : "down";
 * ```
 */
export const usePrevious = (<T>(
  value: T,
  options?: UsePreviousOptions<T>
): T | undefined => {
  const ref = useRef<T | undefined>(options?.initialValue);

  useEffect(() => {
    ref.current = value;
  });

  return ref.current;
}) as UsePrevious;
