import { useDocVisible } from "@/hooks";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("useDocVisible", () => {
  let visibilityState: DocumentVisibilityState;

  beforeEach(() => {
    // Set up initial visibility state
    visibilityState = "visible";

    // Mock document.visibilityState
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get() {
        return visibilityState;
      },
    });
  });

  it("should return true when document is initially visible", () => {
    visibilityState = "visible";
    const { result } = renderHook(() => useDocVisible());

    expect(result.current).toBe(true);
  });

  it("should return false when document is initially hidden", () => {
    visibilityState = "hidden";
    const { result } = renderHook(() => useDocVisible());

    expect(result.current).toBe(false);
  });

  it("should update state when visibility changes from visible to hidden", () => {
    visibilityState = "visible";
    const { result } = renderHook(() => useDocVisible());

    expect(result.current).toBe(true);

    act(() => {
      visibilityState = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current).toBe(false);
  });

  it("should update state when visibility changes from hidden to visible", () => {
    visibilityState = "hidden";
    const { result } = renderHook(() => useDocVisible());

    expect(result.current).toBe(false);

    act(() => {
      visibilityState = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current).toBe(true);
  });

  it("should call onChange callback when visibility changes", () => {
    const onChange = vi.fn();
    visibilityState = "visible";

    renderHook(() => useDocVisible({ onChange }));

    act(() => {
      visibilityState = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("should call onChange callback with correct values on multiple changes", () => {
    const onChange = vi.fn();
    visibilityState = "visible";

    renderHook(() => useDocVisible({ onChange }));

    act(() => {
      visibilityState = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(onChange).toHaveBeenCalledWith(false);

    act(() => {
      visibilityState = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(onChange).toHaveBeenCalledWith(true);

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("should not call onChange callback on initial mount", () => {
    const onChange = vi.fn();
    visibilityState = "visible";

    renderHook(() => useDocVisible({ onChange }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("should handle onChange callback updates", () => {
    const onChange1 = vi.fn();
    const onChange2 = vi.fn();
    visibilityState = "visible";

    const { rerender } = renderHook(
      ({ callback }) => useDocVisible({ onChange: callback }),
      {
        initialProps: { callback: onChange1 },
      }
    );

    act(() => {
      visibilityState = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onChange1).toHaveBeenCalledWith(false);
    expect(onChange2).not.toHaveBeenCalled();

    // Update the callback
    rerender({ callback: onChange2 });

    act(() => {
      visibilityState = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onChange1).toHaveBeenCalledTimes(1);
    expect(onChange2).toHaveBeenCalledWith(true);
  });

  it("should properly cleanup event listeners on unmount", () => {
    const addEventListenerSpy = vi.spyOn(document, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useDocVisible());

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it("should not trigger updates after unmount", () => {
    const onChange = vi.fn();
    visibilityState = "visible";

    const { unmount } = renderHook(() => useDocVisible({ onChange }));

    unmount();

    act(() => {
      visibilityState = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("should handle rapid visibility changes correctly", () => {
    const onChange = vi.fn();
    visibilityState = "visible";

    renderHook(() => useDocVisible({ onChange }));

    act(() => {
      visibilityState = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    act(() => {
      visibilityState = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    act(() => {
      visibilityState = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenNthCalledWith(1, false);
    expect(onChange).toHaveBeenNthCalledWith(2, true);
    expect(onChange).toHaveBeenNthCalledWith(3, false);
  });

  it("should return stable reference between re-renders when visibility doesn't change", () => {
    visibilityState = "visible";
    const { result, rerender } = renderHook(() => useDocVisible());

    const firstValue = result.current;
    rerender();
    const secondValue = result.current;

    expect(firstValue).toBe(secondValue);
  });

  it("should handle prerender visibility state", () => {
    visibilityState = "prerender" as DocumentVisibilityState;
    const { result } = renderHook(() => useDocVisible());

    // prerender is not "visible", so should return false
    expect(result.current).toBe(false);

    act(() => {
      visibilityState = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current).toBe(true);
  });

  it("should not call onChange when visibility state is the same", () => {
    const onChange = vi.fn();
    visibilityState = "visible";

    renderHook(() => useDocVisible({ onChange }));

    // Dispatch event but keep same visibility state
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
