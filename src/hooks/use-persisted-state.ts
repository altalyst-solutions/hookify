import { useEffect, useRef, useState } from "react";

/**
 * A custom React hook for managing state that persists to `localStorage`.
 *
 * This hook allows you to maintain a state value that is automatically saved to and loaded from `localStorage`. It also synchronizes the state across multiple tabs when the same key is updated elsewhere.
 *
 * @template T - The type of the state value.
 * @param {string} key - The unique key used to store the value in `localStorage`.
 * @param {T} initialValue - The initial value for the state if no value exists in `localStorage`.
 * @returns {[T, (value: T | ((prevState: T) => T)) => void]} - An array containing the current state and a function to update it.
 *
 * @example
 * ```typescript
 * const [theme, setTheme] = usePersistedState<"light" | "dark">("theme", "light");
 *
 * return (
 *   <div style={{ background: theme === "dark" ? "#333" : "#fff", color: theme === "dark" ? "#fff" : "#000" }}>
 *     <p>Current Theme: {theme}</p>
 *     <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
 *       Toggle Theme
 *     </button>
 *   </div>
 * );
 * ```
 *
 * @example
 * ```typescript
 * const [counter, setCounter] = usePersistedState<number>("counter", 0);
 *
 * return (
 *   <div>
 *     <p>Counter: {counter}</p>
 *     <button onClick={() => setCounter((prev) => prev + 1)}>Increment</button>
 *   </div>
 * );
 * ```
 *
 * For a complete example, see [examples/usePersistedState.ts](../../examples/basic/src/components/use-persisted-state/index.tsx).
 */
export const usePersistedState = <T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prevState: T) => T)) => void] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, value]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue) {
        try {
          setValue(JSON.parse(event.newValue) as T);
        } catch {
          console.warn(`Error parsing storage event for key "${key}".`);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [key]);

  return [value, setValue] as const;
};
