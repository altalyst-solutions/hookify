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
  storage: PersistedStateStorage;
  newValue: string;
  source: object;
}

/**
 * The storage `usePersistedState` reads from and writes to. `localStorage` and
 * `sessionStorage` both fit, as does any object with the same `getItem` and
 * `setItem` methods (for example an in-memory store in tests).
 */
export type PersistedStateStorage = Pick<Storage, "getItem" | "setItem">;

/** Options for {@link usePersistedState}. */
export interface UsePersistedStateOptions {
  /**
   * Where to persist the value. Defaults to `localStorage`. Use
   * `sessionStorage` to keep the value only for the current tab session.
   *
   * Pass the same storage on every render; switching storages while mounted
   * only affects later reads and writes.
   */
  storage?: PersistedStateStorage;
}

/**
 * Returns `localStorage`, or `undefined` when it isn't available: during
 * server rendering, or when the browser blocks access (some browsers throw a
 * `SecurityError` under strict privacy settings).
 */
const getDefaultStorage = (): PersistedStateStorage | undefined => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

interface Entry<T> {
  key: string;
  value: T;
  /** Whether `value` came from the setter and still needs to be written. */
  persist: boolean;
}

const readStoredValue = <T>(
  storage: PersistedStateStorage | undefined,
  key: string,
  fallback: T
): T => {
  try {
    const item = storage?.getItem(key) ?? null;
    return item === null ? fallback : (JSON.parse(item) as T);
  } catch {
    return fallback;
  }
};

/**
 * A custom React hook for managing state that persists to `localStorage`, or to another storage such as `sessionStorage`.
 *
 * This hook allows you to maintain a state value that is automatically saved to and loaded from storage. It keeps every instance that uses the same key and storage in sync, both in other tabs and in the current tab, and falls back to `initialValue` when the key is removed. When no storage is available (during server rendering, or when the browser blocks `localStorage`), the value is kept in memory only.
 *
 * When `key` changes, the hook reads the value stored under the new key (or uses `initialValue`) instead of carrying the previous value across. The setter keeps a stable identity.
 *
 * @typeParam T - The type of the state value.
 * @param key - The unique key used to store the value.
 * @param initialValue - The initial value for the state if no value is stored yet.
 * @param options - Optional {@link UsePersistedStateOptions | storage} to use instead of `localStorage`.
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
 * @example
 * ```tsx
 * // Kept only for this tab: survives reloads, cleared when the tab closes.
 * const [draft, setDraft] = usePersistedState("comment-draft", "", {
 *   storage: sessionStorage,
 * });
 *
 * return <textarea value={draft} onChange={(e) => setDraft(e.target.value)} />;
 * ```
 *
 * For a live, editable example, see the [usePersistedState docs page](https://altalyst-solutions.github.io/hookify/hooks/use-persisted-state).
 */
export const usePersistedState = <T>(
  key: string,
  initialValue: T,
  options?: UsePersistedStateOptions
): [T, (value: T | ((prevState: T) => T)) => void] => {
  const storage = options?.storage ?? getDefaultStorage();
  // Effects and listeners read the storage through a ref, so an inline storage
  // object doesn't re-run them (and re-write the value) on every render.
  const storageRef = useLatest(storage);
  const initialValueRef = useLatest(initialValue);
  // Identifies this instance so it ignores its own same-tab notifications.
  const [source] = useState(() => ({}));

  const [entry, setEntry] = useState<Entry<T>>(() => ({
    key,
    value: readStoredValue(storage, key, initialValue),
    persist: false,
  }));

  // Re-read storage when the key changes rather than writing the previous
  // key's value under the new key.
  let current = entry;
  if (entry.key !== key) {
    current = {
      key,
      value: readStoredValue(storage, key, initialValue),
      persist: false,
    };
    setEntry(current);
  }

  useEffect(() => {
    const target = storageRef.current;
    if (!entry.persist || !target) return;

    try {
      const serialized = JSON.stringify(entry.value);
      target.setItem(entry.key, serialized);
      window.dispatchEvent(
        new CustomEvent<SameTabDetail>(SAME_TAB_EVENT, {
          detail: {
            key: entry.key,
            storage: target,
            newValue: serialized,
            source,
          },
        })
      );
    } catch (error) {
      console.error(`Error setting storage key "${entry.key}":`, error);
    }
  }, [entry, source, storageRef]);

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
      if (event.storageArea && event.storageArea !== storageRef.current) {
        return;
      }
      // `key` is null when the whole storage area was cleared.
      if (event.key === null) applyExternal(null);
      else if (event.key === key) applyExternal(event.newValue);
    };

    const handleSameTabChange = (event: Event) => {
      const detail = (event as CustomEvent<SameTabDetail>).detail;
      if (
        detail.key === key &&
        detail.storage === storageRef.current &&
        detail.source !== source
      ) {
        applyExternal(detail.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(SAME_TAB_EVENT, handleSameTabChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(SAME_TAB_EVENT, handleSameTabChange);
    };
  }, [key, source, initialValueRef, storageRef]);

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
