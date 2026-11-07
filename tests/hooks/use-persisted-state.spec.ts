import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePersistedState } from "@/hooks";

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

describe("usePersistedState", () => {
  beforeEach(() => {
    // Undone after each test by `unstubGlobals` in vitest.config.ts.
    vi.stubGlobal("localStorage", localStorageMock);
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should initialize with the default value if localStorage is empty", () => {
    const { result } = renderHook(() =>
      usePersistedState("testKey", "defaultValue")
    );

    const [value] = result.current;
    expect(value).toBe("defaultValue");
  });

  it("should initialize with the value from localStorage if it exists", () => {
    localStorage.setItem("testKey", JSON.stringify("storedValue"));

    const { result } = renderHook(() =>
      usePersistedState("testKey", "defaultValue")
    );

    const [value] = result.current;
    expect(value).toBe("storedValue");
  });

  it("should update localStorage when the state changes", () => {
    const { result } = renderHook(() =>
      usePersistedState("testKey", "defaultValue")
    );

    act(() => {
      const [, setValue] = result.current;
      setValue("newValue");
    });

    const storedValue = localStorage.getItem("testKey");
    expect(storedValue).toBe(JSON.stringify("newValue"));
  });

  it("should update the state when localStorage is modified externally", () => {
    const { result } = renderHook(() =>
      usePersistedState("testKey", "defaultValue")
    );

    act(() => {
      localStorage.setItem("testKey", JSON.stringify("externalValue"));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "testKey",
          newValue: JSON.stringify("externalValue"),
        })
      );
    });

    const [value] = result.current;
    expect(value).toBe("externalValue");
  });

  it("should handle malformed JSON in localStorage gracefully", () => {
    localStorage.setItem("testKey", "malformed");

    const { result } = renderHook(() =>
      usePersistedState("testKey", "defaultValue")
    );

    const [value] = result.current;
    expect(value).toBe("defaultValue");
  });

  it("should retain type consistency across updates", () => {
    const { result } = renderHook(() =>
      usePersistedState<number>("testKey", 0)
    );

    act(() => {
      const [, setValue] = result.current;
      setValue(42);
    });

    const [value] = result.current;
    expect(value).toBe(42);
  });

  it("should support multiple instances with different keys", () => {
    const { result: hook1 } = renderHook(() =>
      usePersistedState("key1", "value1")
    );
    const { result: hook2 } = renderHook(() =>
      usePersistedState("key2", "value2")
    );

    act(() => {
      const [, setValue1] = hook1.current;
      const [, setValue2] = hook2.current;
      setValue1("updatedValue1");
      setValue2("updatedValue2");
    });

    const [value1] = hook1.current;
    const [value2] = hook2.current;

    expect(value1).toBe("updatedValue1");
    expect(value2).toBe("updatedValue2");
  });

  it("should read the new key's stored value when the key changes", () => {
    localStorage.setItem("b", JSON.stringify("stored-b"));

    const { result, rerender } = renderHook(
      ({ storageKey }) => usePersistedState(storageKey, "initial"),
      { initialProps: { storageKey: "a" } }
    );

    act(() => {
      result.current[1]("value-a");
    });
    rerender({ storageKey: "b" });

    expect(result.current[0]).toBe("stored-b");
    expect(localStorage.getItem("b")).toBe(JSON.stringify("stored-b"));
    expect(localStorage.getItem("a")).toBe(JSON.stringify("value-a"));
  });

  it("should fall back to the initial value when the new key is empty", () => {
    const { result, rerender } = renderHook(
      ({ storageKey }) => usePersistedState(storageKey, "initial"),
      { initialProps: { storageKey: "a" } }
    );

    act(() => {
      result.current[1]("value-a");
    });
    rerender({ storageKey: "b" });

    expect(result.current[0]).toBe("initial");
    expect(localStorage.getItem("b")).toBeNull();
  });

  it("should write updates to the current key after a key change", () => {
    const { result, rerender } = renderHook(
      ({ storageKey }) => usePersistedState(storageKey, 0),
      { initialProps: { storageKey: "a" } }
    );

    rerender({ storageKey: "b" });
    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(localStorage.getItem("b")).toBe("1");
    expect(localStorage.getItem("a")).toBeNull();
  });

  it("should reset to the initial value when the key is removed in another tab", () => {
    localStorage.setItem("testKey", JSON.stringify("storedValue"));
    const { result } = renderHook(() =>
      usePersistedState("testKey", "defaultValue")
    );

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "testKey", newValue: null })
      );
    });

    expect(result.current[0]).toBe("defaultValue");
  });

  it("should reset to the initial value when storage is cleared in another tab", () => {
    localStorage.setItem("testKey", JSON.stringify("storedValue"));
    const { result } = renderHook(() =>
      usePersistedState("testKey", "defaultValue")
    );

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });

    expect(result.current[0]).toBe("defaultValue");
  });

  it("should ignore storage events from sessionStorage", () => {
    const { result } = renderHook(() =>
      usePersistedState("testKey", "defaultValue")
    );

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "testKey",
          newValue: JSON.stringify("fromSession"),
          storageArea: window.sessionStorage,
        })
      );
    });

    expect(result.current[0]).toBe("defaultValue");
  });

  it("should sync instances that share a key in the same tab", () => {
    const { result: first } = renderHook(() =>
      usePersistedState("shared", "initial")
    );
    const { result: second } = renderHook(() =>
      usePersistedState("shared", "initial")
    );

    act(() => {
      first.current[1]("updated");
    });

    expect(first.current[0]).toBe("updated");
    expect(second.current[0]).toBe("updated");
  });

  it("should not write back a value received from another instance", () => {
    const setItemSpy = vi.spyOn(localStorage, "setItem");
    const { result: first } = renderHook(() =>
      usePersistedState("shared", { count: 0 })
    );
    renderHook(() => usePersistedState("shared", { count: 0 }));

    act(() => {
      first.current[1]({ count: 1 });
    });

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    setItemSpy.mockRestore();
  });

  it("should keep the setter stable across renders", () => {
    const { result, rerender } = renderHook(() =>
      usePersistedState("testKey", "defaultValue")
    );
    const setter = result.current[1];

    act(() => {
      setter("next");
    });
    rerender();

    expect(result.current[1]).toBe(setter);
  });
});
