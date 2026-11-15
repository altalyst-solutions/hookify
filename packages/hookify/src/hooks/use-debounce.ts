import { useDebouncedCallback } from "./use-debounced-callback";

/**
 * Debounces a function so it only runs after `delay` milliseconds have passed
 * since its last call.
 *
 * @deprecated Use `useDebouncedCallback`, which takes the same arguments and
 * returns the same stable function (plus `cancel`, `flush` and `isPending`),
 * or `useDebouncedValue` to debounce a value instead. This alias will be
 * removed in a future release.
 *
 * @example
 * ```ts
 * // Before
 * const debouncedSearch = useDebounce(search, 300);
 * // After
 * const debouncedSearch = useDebouncedCallback(search, 300);
 * ```
 */
export const useDebounce = useDebouncedCallback;
