import type { UseThrottledValueOptions } from "./use-throttled-value";
import { useThrottledValue } from "./use-throttled-value";

/**
 * Options for {@link useThrottle}.
 *
 * @deprecated Renamed to `UseThrottledValueOptions`. This alias will be
 * removed in a future release.
 */
export type UseThrottleOptions = UseThrottledValueOptions;

/**
 * Returns a throttled copy of `value` that updates at most once per `delay`
 * milliseconds.
 *
 * @deprecated Renamed to `useThrottledValue` so the name says it throttles a
 * value, matching `useDebouncedValue` and `useDebouncedCallback`. It behaves
 * exactly the same; replace the import. This alias will be removed in a future
 * release.
 *
 * @example
 * ```ts
 * // Before
 * const throttled = useThrottle(value, 200);
 * // After
 * const throttled = useThrottledValue(value, 200);
 * ```
 */
export const useThrottle = useThrottledValue;
