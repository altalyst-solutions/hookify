import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePrevious } from "@/hooks";

describe("usePrevious", () => {
  it("returns undefined on the first render", () => {
    const { result } = renderHook(() => usePrevious(1));

    expect(result.current).toBeUndefined();
  });

  it("returns the initialValue on the first render when provided", () => {
    const { result } = renderHook(() => usePrevious(1, { initialValue: 0 }));

    expect(result.current).toBe(0);
  });

  it("returns the value from the previous render", () => {
    const { result, rerender } = renderHook(({ value }) => usePrevious(value), {
      initialProps: { value: "a" },
    });

    rerender({ value: "b" });
    expect(result.current).toBe("a");

    rerender({ value: "c" });
    expect(result.current).toBe("b");
  });

  it("returns the same value on a rerender with an unchanged value", () => {
    const { result, rerender } = renderHook(({ value }) => usePrevious(value), {
      initialProps: { value: "a" },
    });

    rerender({ value: "b" });
    rerender({ value: "b" });

    expect(result.current).toBe("b");
  });

  it("does not trigger extra renders", () => {
    let renders = 0;
    const { rerender } = renderHook(
      ({ value }) => {
        renders++;
        return usePrevious(value);
      },
      { initialProps: { value: 1 } }
    );

    rerender({ value: 2 });

    expect(renders).toBe(2);
  });

  it("supports object values by reference", () => {
    const first = { id: 1 };
    const second = { id: 2 };
    const { result, rerender } = renderHook(({ value }) => usePrevious(value), {
      initialProps: { value: first },
    });

    rerender({ value: second });

    expect(result.current).toBe(first);
  });
});
