import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useEffectAfterMount } from "@/hooks";

describe("useEffectAfterMount", () => {
  it("should not call the function on the initial render", () => {
    const fn = vi.fn();
    renderHook(() => useEffectAfterMount(fn));

    expect(fn).not.toHaveBeenCalled();
  });

  it("should call the function on subsequent renders when dependencies change", () => {
    const fn = vi.fn();
    const { rerender } = renderHook(
      ({ deps }) => useEffectAfterMount(fn, deps),
      {
        initialProps: { deps: [1] },
      }
    );

    // Update deps to trigger the effect
    rerender({ deps: [2] });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should not call the function if dependencies remain the same", () => {
    const fn = vi.fn();
    const deps = [1]; // Keep the same array reference
    const { rerender } = renderHook(() => useEffectAfterMount(fn, deps));

    // Rerender with the same array reference
    rerender();

    expect(fn).not.toHaveBeenCalled();
  });

  it("should not call the function when an inline deps array has unchanged values", () => {
    const fn = vi.fn();
    const { rerender } = renderHook(
      ({ value }) => useEffectAfterMount(fn, [value]),
      { initialProps: { value: 1 } }
    );

    rerender({ value: 1 });

    expect(fn).not.toHaveBeenCalled();
  });

  it("should call the function when an inline deps array value changes", () => {
    const fn = vi.fn();
    const { rerender } = renderHook(
      ({ value }) => useEffectAfterMount(fn, [value]),
      { initialProps: { value: 1 } }
    );

    rerender({ value: 2 });

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
