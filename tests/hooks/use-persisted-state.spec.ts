import { usePersistedState } from "@/hooks";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("usePersistedState", () => {
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
});
