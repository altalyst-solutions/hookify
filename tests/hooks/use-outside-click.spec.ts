import { useOutsideClick } from "@/hooks";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("useOutsideClick", () => {
  it("should call the callback when clicking outside the referenced element", () => {
    const callback = vi.fn();
    const ref = { current: document.createElement("div") };

    document.body.appendChild(ref.current);
    renderHook(() => useOutsideClick(ref, callback));
    document.body.click();

    expect(callback).toHaveBeenCalledTimes(1);

    document.body.removeChild(ref.current);
  });

  it("should not call the callback when clicking inside the referenced element", () => {
    const callback = vi.fn();
    const ref = { current: document.createElement("div") };

    document.body.appendChild(ref.current);
    renderHook(() => useOutsideClick(ref, callback));
    ref.current.click();

    expect(callback).not.toHaveBeenCalled();

    document.body.removeChild(ref.current);
  });

  it("should handle no reference gracefully", () => {
    const callback = vi.fn();
    const ref = { current: null };

    renderHook(() => useOutsideClick(ref, callback));
    document.body.click();

    expect(callback).not.toHaveBeenCalled();
  });
});
