import { useCallback, useEffect, useRef } from "react";

/**
 * A custom React hook that debounce a function, ensuring it is only called after a specified delay has passed
 * since the last invocation.
 *
 * This hook is useful for optimizing performance in scenarios where frequent function calls need to be reduced,
 * such as handling search input, resize events, or button clicks.
 *
 * @template T - The type of the callback function to debounce.
 * @param {T} callback - The function to be debounced.
 * @param {number} delay - The debounce delay in milliseconds.
 * @returns {(...args: Parameters<T>) => void} - A debounced version of the provided callback function.
 *
 * @example
 * ```typescript
 * const [query, setQuery] = useState("");
 *
 * const fetchData = (searchTerm: string) => {
 *   console.log(`Fetching data for ${searchTerm}`);
 * };
 *
 * const debouncedFetchData = useDebounce(fetchData, 300);
 *
 * const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
 *   setQuery(event.target.value);
 *   debouncedFetchData(event.target.value);
 * };
 *
 * return <input type="text" value={query} onChange={handleInputChange} />;
 * ```
 *
 * @example
 * ```typescript
 * const logMessage = (message: string) => {
 *   console.log(message);
 * };
 *
 * const debouncedLog = useDebounce(logMessage, 500);
 *
 * return <button onClick={() => debouncedLog("Button clicked!")}>Click Me</button>;
 * ```
 *
 * For a complete example, see [examples/useDebounce.ts](../../examples/basic/src/components/use-debounce/index.tsx).
 *
 * @see [Debouncing in JavaScript](https://www.freecodecamp.org/news/javascript-debounce-example)
 */
export const useDebounce = <T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
};
