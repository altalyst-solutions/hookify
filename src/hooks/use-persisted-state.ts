import { useCallback, useEffect, useState } from "react";

import { useLatest } from "./use-latest";

/**
 * Name of the window event used to sync `usePersistedState` instances that
 * share a key within the same tab (the native `storage` event only reaches
 * other tabs).
 */
const SAME_TAB_EVENT = "hookify:persisted-state";

interface SameTabDetail {
  key: string;
  newValue: string;
  source: object;
}

interface Entry<T> {
  key: string;
  value: T;
  /** Whether `value` came from the setter and still needs to be written. */
  persist: boolean;
}

const readStoredValue = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item === null ? fallback : (JSON.parse(item) as T);
  } catch {
    return fallback;
  }
};

/**
 * A custom React hook for managing state that persists to `localStorage`.
 *
 * This hook allows you to maintain a state value that is automatically saved to and loaded from `localStorage`. It keeps every instance that uses the same key in sync, both in other tabs and in the current tab, and falls back to `initialValue` when the key is removed.
 *
 * When `key` changes, the hook reads the value stored under the new key (or uses `initialValue`) instead of carrying the previous value across. The setter keeps a stable identity.
 *
 * @typeParam T - The type of the state value.
 * @param key - The unique key used to store the value in `localStorage`.
 * @param initialValue - The initial value for the state if no value exists in `localStorage`.
 * @returns An array containing the current state and a function to update it.
 *
 * @example
 * ```tsx
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
 * ```tsx
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
 * For a live, editable example, see the [usePersistedState docs page](https://altalyst-solutions.github.io/hookify/hooks/use-persisted-state).
 */
export const usePersistedState = <T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prevState: T) => T)) => void] => {
  const initialValueRef = useLatest(initialValue);
  // Identifies this instance so it ignores its own same-tab notifications.
  const [source] = useState(() => ({}));

  const [entry, setEntry] = useState<Entry<T>>(() => ({
    key,
    value: readStoredValue(key, initialValue),
    persist: false,
  }));

  // Re-read storage when the key changes rather than writing the previous
  // key's value under the new key.
  let current = entry;
  if (entry.key !== key) {
    current = {
      key,
      value: readStoredValue(key, initialValue),
      persist: false,
    };
    setEntry(current);
  }

  useEffect(() => {
    if (!entry.persist) return;

    try {
      const serialized = JSON.stringify(entry.value);
      localStorage.setItem(entry.key, serialized);
      window.dispatchEvent(
        new CustomEvent<SameTabDetail>(SAME_TAB_EVENT, {
          detail: { key: entry.key, newValue: serialized, source },
        })
      );
    } catch (error) {
      console.error(`Error setting localStorage key "${entry.key}":`, error);
    }
  }, [entry, source]);

  useEffect(() => {
    const applyExternal = (newValue: string | null) => {
      if (newValue === null) {
        setEntry({ key, value: initialValueRef.current, persist: false });
        return;
      }
      try {
        setEntry({
          key,
          value: JSON.parse(newValue) as T,
          persist: false,
        });
      } catch {
        console.warn(`Error parsing storage event for key "${key}".`);
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== localStorage) return;
      // `key` is null when the whole storage area was cleared.
      if (event.key === null) applyExternal(null);
      else if (event.key === key) applyExternal(event.newValue);
    };

    const handleSameTabChange = (event: Event) => {
      const detail = (event as CustomEvent<SameTabDetail>).detail;
      if (detail.key === key && detail.source !== source) {
        applyExternal(detail.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(SAME_TAB_EVENT, handleSameTabChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(SAME_TAB_EVENT, handleSameTabChange);
    };
  }, [key, source, initialValueRef]);

  const setValue = useCallback((next: T | ((prevState: T) => T)) => {
    setEntry((prev) => ({
      key: prev.key,
      value:
        typeof next === "function"
          ? (next as (prevState: T) => T)(prev.value)
          : next,
      persist: true,
    }));
  }, []);

  return [current.value, setValue];
};
