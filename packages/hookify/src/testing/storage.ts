import { replaceProperty } from "./replace-global";

/** Options for {@link createMemoryStorage}. */
export interface MemoryStorageOptions {
  /** Items to start with, by key. Default is none. */
  items?: Record<string, string>;
  /**
   * The most characters the storage may hold, counting every key and every
   * value, as a browser does. Writing past it throws a `QuotaExceededError`
   * `DOMException`, and `0` makes every write fail. Default is no limit.
   */
  quota?: number;
}

/** The storage returned by {@link createMemoryStorage}. */
export interface MemoryStorage extends Storage {
  /**
   * The items as a plain object, as a copy. Handy for assertions, such as
   * `expect(storage.snapshot()).toEqual({ theme: '"dark"' })`.
   */
  snapshot(): Record<string, string>;
}

/** Options for {@link installLocalStorage} and {@link installSessionStorage}. */
export interface InstallStorageOptions {
  /**
   * The storage to put on the window. Default is a new one from
   * {@link createMemoryStorage}.
   */
  storage?: Storage;
  /**
   * Makes reading the global throw a `SecurityError` `DOMException`, as
   * browsers do when storage is blocked, for example by privacy settings or in
   * a sandboxed frame. Default is `false`.
   */
  blocked?: boolean;
}

/** Returned by {@link installLocalStorage} and {@link installSessionStorage}. */
export interface StorageController {
  /** The storage that is installed. */
  readonly storage: Storage;
  /**
   * Puts back what was there before, or removes the global if there was none.
   * Calling it more than once does nothing.
   */
  restore(): void;
}

/**
 * Builds the class that implements `Storage` in memory.
 *
 * @returns The class.
 */
const createStorageClass = () =>
  class implements MemoryStorage {
    [name: string]: unknown;

    private readonly items = new Map<string, string>();
    private readonly quota: number;

    constructor({ items = {}, quota = Infinity }: MemoryStorageOptions) {
      this.quota = quota;
      for (const [key, value] of Object.entries(items)) {
        this.items.set(key, String(value));
      }
    }

    get length() {
      return this.items.size;
    }

    key(index: number) {
      return [...this.items.keys()][index] ?? null;
    }

    getItem(key: string) {
      return this.items.get(String(key)) ?? null;
    }

    setItem(key: string, value: string) {
      const name = String(key);
      const text = String(value);
      const size = [...this.items].reduce(
        (total, [k, v]) => total + (k === name ? 0 : k.length + v.length),
        name.length + text.length
      );
      if (size > this.quota) {
        throw new DOMException(
          `Failed to execute 'setItem' on 'Storage': Setting the value of '${name}' exceeded the quota.`,
          "QuotaExceededError"
        );
      }
      this.items.set(name, text);
    }

    removeItem(key: string) {
      this.items.delete(String(key));
    }

    clear() {
      this.items.clear();
    }

    snapshot() {
      return Object.fromEntries(this.items);
    }
  };

/** The class that backs every {@link createMemoryStorage} call. */
const MemoryStorageClass = createStorageClass();

/**
 * Creates a `Storage` that keeps its items in memory.
 *
 * It behaves like `localStorage` and `sessionStorage`: keys and values are
 * strings, a missing key reads as `null`, and `key(index)` and `length` work.
 * Pass it wherever code accepts a `Storage`, such as the `storage` option of
 * `usePersistedState`, or put it on the window with
 * {@link installLocalStorage}. Unlike the real ones, it never fires `storage`
 * events: use {@link dispatchStorageEvent} to simulate another tab.
 *
 * @param options - See {@link MemoryStorageOptions}.
 * @returns A new, independent storage.
 *
 * @example
 * ```ts
 * import { createMemoryStorage } from "@altalyst/hookify/testing";
 *
 * const storage = createMemoryStorage({ items: { theme: '"dark"' } });
 * storage.getItem("theme"); // '"dark"'
 *
 * const full = createMemoryStorage({ quota: 0 });
 * full.setItem("a", "b"); // throws a QuotaExceededError
 * ```
 *
 * @see {@link https://developer.mozilla.org/docs/Web/API/Storage | Storage on MDN}
 */
export const createMemoryStorage = (
  options: MemoryStorageOptions = {}
): MemoryStorage => new MemoryStorageClass(options);

/**
 * Replaces a storage global on the window.
 *
 * @param name - Which one, `localStorage` or `sessionStorage`.
 * @param options - See {@link InstallStorageOptions}.
 * @returns The controller.
 */
const installStorage = (
  name: "localStorage" | "sessionStorage",
  options: InstallStorageOptions
): StorageController => {
  const storage = options.storage ?? createMemoryStorage();
  const restore = replaceProperty(globalThis, name, {
    get: () => {
      if (options.blocked) {
        throw new DOMException(
          `Failed to read the '${name}' property from 'Window': Access is denied for this document.`,
          "SecurityError"
        );
      }
      return storage;
    },
  });

  return { storage, restore };
};

/**
 * Replaces `window.localStorage` with an in-memory storage.
 *
 * Useful when the code under test reads `localStorage` itself, such as
 * `usePersistedState` without a `storage` option. Call
 * {@link StorageController.restore | restore} when the test ends, such as in
 * `afterEach`, so the fake doesn't leak into other tests.
 *
 * @param options - See {@link InstallStorageOptions}.
 * @returns A controller with the installed storage and `restore()`.
 *
 * @example
 * ```tsx
 * import { render, screen } from "@testing-library/react";
 * import { installLocalStorage } from "@altalyst/hookify/testing";
 *
 * const local = installLocalStorage();
 * afterEach(() => local.restore());
 *
 * it("starts from the saved theme", () => {
 *   local.storage.setItem("theme", JSON.stringify("dark"));
 *
 *   render(<ThemeSwitcher />);
 *
 *   expect(screen.getByText("dark")).toBeInTheDocument();
 * });
 * ```
 */
export const installLocalStorage = (
  options: InstallStorageOptions = {}
): StorageController => installStorage("localStorage", options);

/**
 * Replaces `window.sessionStorage` with an in-memory storage. It works like
 * {@link installLocalStorage}.
 *
 * @param options - See {@link InstallStorageOptions}.
 * @returns A controller with the installed storage and `restore()`.
 */
export const installSessionStorage = (
  options: InstallStorageOptions = {}
): StorageController => installStorage("sessionStorage", options);

/**
 * Simulates another tab changing storage.
 *
 * Browsers fire `storage` events only in the tabs that did not make the
 * change, so a test has to fire them itself. This applies the change to
 * `storage` without firing anything, as another tab's write would, and then
 * dispatches a `storage` event on the window with the old value, the new value
 * and `storageArea` set. Wrap it in `act()` if a listener updates React state.
 *
 * @param key - The key that changed, or `null` for `clear()`.
 * @param newValue - The new value, or `null` if the key was removed or the
 * storage was cleared.
 * @param storage - The storage that changed. If it is omitted, only the event
 * is fired, with no `storageArea`, and no storage is changed.
 *
 * @example
 * ```tsx
 * import { act, render, screen } from "@testing-library/react";
 * import { dispatchStorageEvent, installLocalStorage } from "@altalyst/hookify/testing";
 *
 * const local = installLocalStorage();
 * afterEach(() => local.restore());
 *
 * it("follows changes made in another tab", () => {
 *   render(<ThemeSwitcher />);
 *
 *   act(() => {
 *     dispatchStorageEvent("theme", JSON.stringify("dark"), local.storage);
 *   });
 *
 *   expect(screen.getByText("dark")).toBeInTheDocument();
 * });
 * ```
 */
export const dispatchStorageEvent = (
  key: string | null,
  newValue: string | null,
  storage?: Storage
): void => {
  const oldValue = storage && key !== null ? storage.getItem(key) : null;

  if (storage) {
    if (key === null) storage.clear();
    else if (newValue === null) storage.removeItem(key);
    else storage.setItem(key, newValue);
  }

  // The `StorageEvent` constructor only accepts the browser's own `Storage`
  // objects for `storageArea`, so a fake one is set on the event afterwards.
  const event = new StorageEvent("storage", {
    key,
    oldValue,
    newValue,
    url: window.location.href,
  });
  Object.defineProperty(event, "storageArea", {
    configurable: true,
    value: storage ?? null,
  });
  window.dispatchEvent(event);
};
