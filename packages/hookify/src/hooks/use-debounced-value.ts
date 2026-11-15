import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates once `value` has
 * stopped changing for `delay` milliseconds.
 *
 * Every change restarts the wait, so while `value` keeps changing faster than
 * `delay` the returned value stays the same. On the first render it equals
 * `value`. It is the debounce counterpart to `useThrottledValue`, which instead
 * guarantees regular updates while the value keeps changing. To debounce a
 * function call rather than a value, use `useDebouncedCallback`.
 *
 * Values are compared with `Object.is`, a changed `delay` restarts the current
 * wait, and the pending update is dropped on unmount.
 *
 * @typeParam T - The type of the value to debounce.
 * @param value - The value to debounce.
 * @param delay - How long `value` must stay unchanged, in milliseconds.
 * @returns The debounced value.
 *
 * @example
 * ```tsx
 * const [query, setQuery] = useState("");
 * const debouncedQuery = useDebouncedValue(query, 300);
 *
 * // Only fetches once the user pauses typing for 300 ms.
 * const { data } = useApi(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
 *
 * return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
 * ```
 *
 * For a live, editable example, see the [useDebouncedValue docs page](https://altalyst-solutions.github.io/hookify/hooks/use-debounced-value).
 */
export const useDebouncedValue = <T>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(() => value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};
