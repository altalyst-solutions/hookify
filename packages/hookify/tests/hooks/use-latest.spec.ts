import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useLatest } from "@/hooks";

describe("useLatest", () => {
  it("returns the initial value", () => {
    const { result } = renderHook(() => useLatest(1));

    expect(result.current.current).toBe(1);
  });

  it("updates the ref to the latest value after rerender", () => {
    const { result, rerender } = renderHook(({ value }) => useLatest(value), {
      initialProps: { value: "a" },
    });

    rerender({ value: "b" });

    expect(result.current.current).toBe("b");
  });

  it("returns a stable ref across renders", () => {
    const { result, rerender } = renderHook(({ value }) => useLatest(value), {
      initialProps: { value: 1 },
    });
    const first = result.current;

    rerender({ value: 2 });

    expect(result.current).toBe(first);
  });

  it("lets a long-lived closure read the latest callback", () => {
    const calls: string[] = [];
    const { result, rerender } = renderHook(({ cb }) => useLatest(cb), {
      initialProps: { cb: () => calls.push("old") },
    });
    const ref = result.current;

    rerender({ cb: () => calls.push("new") });
    ref.current();

    expect(calls).toEqual(["new"]);
  });
});
