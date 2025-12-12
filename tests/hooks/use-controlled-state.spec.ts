import { useControlledState } from "@/hooks";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("useControlledState", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Uncontrolled Mode", () => {
    it("should use defaultValue as initial value", () => {
      const { result } = renderHook(() =>
        useControlledState<string>(undefined, "initial", undefined)
      );

      expect(result.current[0]).toBe("initial");
    });

    it("should update internal state when setValue is called", () => {
      const { result } = renderHook(() =>
        useControlledState<string>(undefined, "initial", undefined)
      );

      act(() => {
        result.current[1]("updated");
      });

      expect(result.current[0]).toBe("updated");
    });

    it("should call onChange callback when value changes", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useControlledState<string>(undefined, "initial", onChange)
      );

      act(() => {
        result.current[1]("updated");
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("updated");
    });

    it("should support lazy initialization", () => {
      const lazyInit = vi.fn(() => "lazy-value");
      const { result } = renderHook(() =>
        useControlledState<string>(undefined, lazyInit, undefined)
      );

      expect(lazyInit).toHaveBeenCalledTimes(1);
      expect(result.current[0]).toBe("lazy-value");
    });

    it("should support updater function", () => {
      const { result } = renderHook(() =>
        useControlledState<number>(undefined, 0, undefined)
      );

      act(() => {
        result.current[1]((prev) => prev + 1);
      });

      expect(result.current[0]).toBe(1);

      act(() => {
        result.current[1]((prev) => prev + 5);
      });

      expect(result.current[0]).toBe(6);
    });

    it("should work with complex types", () => {
      type User = { name: string; age: number };
      const defaultUser: User = { name: "John", age: 30 };

      const { result } = renderHook(() =>
        useControlledState<User>(undefined, defaultUser, undefined)
      );

      expect(result.current[0]).toEqual(defaultUser);

      act(() => {
        result.current[1]({ name: "Jane", age: 25 });
      });

      expect(result.current[0]).toEqual({ name: "Jane", age: 25 });
    });
  });

  describe("Controlled Mode", () => {
    it("should use controlled value when provided", () => {
      const { result } = renderHook(() =>
        useControlledState<string>("controlled", "default", undefined)
      );

      expect(result.current[0]).toBe("controlled");
    });

    it("should not update internal state when setValue is called", () => {
      const onChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ value }) => useControlledState(value, "default", onChange),
        { initialProps: { value: "controlled" as string | undefined } }
      );

      act(() => {
        result.current[1]("attempted-update");
      });

      // Value should still be controlled value
      expect(result.current[0]).toBe("controlled");
      // onChange should still be called
      expect(onChange).toHaveBeenCalledWith("attempted-update");

      // Value only changes when parent updates it
      rerender({ value: "new-controlled" });
      expect(result.current[0]).toBe("new-controlled");
    });

    it("should update when controlled value changes", () => {
      const { result, rerender } = renderHook(
        ({ value }) => useControlledState<string>(value, "default", undefined),
        { initialProps: { value: "first" as string | undefined } }
      );

      expect(result.current[0]).toBe("first");

      rerender({ value: "second" });
      expect(result.current[0]).toBe("second");

      rerender({ value: "third" });
      expect(result.current[0]).toBe("third");
    });

    it("should support updater function in controlled mode", () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useControlledState<number>(10, 0, onChange)
      );

      act(() => {
        result.current[1]((prev) => prev + 5);
      });

      // onChange called with updated value
      expect(onChange).toHaveBeenCalledWith(15);
      // But displayed value is still controlled value
      expect(result.current[0]).toBe(10);
    });
  });

  describe("Performance", () => {
    it("should recreate setValue when onChange changes", () => {
      const onChange1 = vi.fn();
      const onChange2 = vi.fn();

      const { result, rerender } = renderHook(
        ({ onChange }) =>
          useControlledState<string>(undefined, "default", onChange),
        { initialProps: { onChange: onChange1 } }
      );

      const firstSetter = result.current[1];

      rerender({ onChange: onChange2 });
      const secondSetter = result.current[1];

      expect(firstSetter).not.toBe(secondSetter);
    });
  });

  describe("Development Warnings", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should warn when switching from uncontrolled to controlled", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { rerender } = renderHook(
        ({ value }) => useControlledState<string>(value, "default", undefined),
        { initialProps: { value: undefined as string | undefined } }
      );

      // Switch to controlled
      rerender({ value: "controlled" });

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("uncontrolled to controlled")
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("may cause unexpected behavior")
      );
    });

    it("should warn when switching from controlled to uncontrolled", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { rerender } = renderHook(
        ({ value }) => useControlledState<string>(value, "default", undefined),
        { initialProps: { value: "controlled" as string | undefined } }
      );

      // Switch to uncontrolled
      rerender({ value: undefined });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("controlled to uncontrolled")
      );
    });

    it("should not warn when staying in the same mode", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { rerender } = renderHook(
        ({ value }) => useControlledState<string>(value, "default", undefined),
        { initialProps: { value: "first" as string | undefined } }
      );

      rerender({ value: "second" });
      rerender({ value: "third" });

      expect(warnSpy).not.toHaveBeenCalled();
    });

    // Note: Production mode test cannot be reliably tested in unit tests
    // because isDevelopment is evaluated at module load time.
    // In real production builds, bundlers will tree-shake the warning code entirely.
  });

  describe("Edge Cases", () => {
    it("should handle boolean values correctly", () => {
      const { result } = renderHook(() =>
        useControlledState<boolean>(undefined, false, undefined)
      );

      expect(result.current[0]).toBe(false);

      act(() => {
        result.current[1](true);
      });

      expect(result.current[0]).toBe(true);
    });

    it("should handle 0 as a valid controlled value", () => {
      const { result } = renderHook(() =>
        useControlledState<number>(0, 100, undefined)
      );

      // 0 should be treated as controlled, not uncontrolled
      expect(result.current[0]).toBe(0);
    });

    it("should handle empty string as controlled value", () => {
      const { result } = renderHook(() =>
        useControlledState<string>("", "default", undefined)
      );

      expect(result.current[0]).toBe("");
    });

    it("should handle null as controlled value", () => {
      const { result } = renderHook(() =>
        useControlledState<string | null>(null, "default", undefined)
      );

      expect(result.current[0]).toBe(null);
    });

    it("should not call onChange on initial render", () => {
      const onChange = vi.fn();
      renderHook(() =>
        useControlledState<string>(undefined, "initial", onChange)
      );

      expect(onChange).not.toHaveBeenCalled();
    });

    it("should handle rapid value changes", () => {
      const { result } = renderHook(() =>
        useControlledState<number>(undefined, 0, undefined)
      );

      act(() => {
        result.current[1](1);
        result.current[1](2);
        result.current[1](3);
        result.current[1](4);
        result.current[1](5);
      });

      expect(result.current[0]).toBe(5);
    });
  });
});
