import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useOutsideClick } from "@/hooks";

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

  it("should call the callback once for a tap that fires touchstart and click", () => {
    const callback = vi.fn();
    const ref = { current: document.createElement("div") };

    document.body.appendChild(ref.current);
    renderHook(() => useOutsideClick(ref, callback));
    fireEvent.touchStart(document.body);
    fireEvent.click(document.body);

    expect(callback).toHaveBeenCalledTimes(1);

    document.body.removeChild(ref.current);
  });

  it("should handle a later click after a tap as a new interaction", () => {
    const callback = vi.fn();
    const ref = { current: document.createElement("div") };

    document.body.appendChild(ref.current);
    renderHook(() => useOutsideClick(ref, callback));
    fireEvent.touchStart(document.body);
    vi.advanceTimersByTime(2000);
    fireEvent.click(document.body);

    expect(callback).toHaveBeenCalledTimes(2);

    document.body.removeChild(ref.current);
  });

  it("should call the latest callback without re-subscribing", () => {
    const first = vi.fn();
    const second = vi.fn();
    const ref = { current: document.createElement("div") };
    const addSpy = vi.spyOn(document, "addEventListener");

    document.body.appendChild(ref.current);
    const { rerender } = renderHook(({ cb }) => useOutsideClick(ref, cb), {
      initialProps: { cb: first },
    });
    const subscriptions = addSpy.mock.calls.length;
    rerender({ cb: second });
    document.body.click();

    expect(addSpy.mock.calls.length).toBe(subscriptions);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    addSpy.mockRestore();
    document.body.removeChild(ref.current);
  });
});
