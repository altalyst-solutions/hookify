import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDebounce } from "@/hooks";

describe("useDebounce", () => {
  it("should delay the callback execution by the specified delay", () => {
    const callback = vi.fn();
    const delay = 200;
    const { result } = renderHook(() => useDebounce(callback, delay));

    act(() => {
      result.current("test");
    });

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("test");
  });

  it("should reset the delay if called again within the delay period", () => {
    const callback = vi.fn();
    const delay = 200;
    const { result } = renderHook(() => useDebounce(callback, delay));

    act(() => {
      result.current("test1");
      vi.advanceTimersByTime(100); // Partial delay
      result.current("test2"); // Reset delay
    });

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("test2");
  });

  it("should not call the callback after the component unmounts", () => {
    const callback = vi.fn();
    const delay = 200;
    const { result, unmount } = renderHook(() => useDebounce(callback, delay));

    act(() => {
      result.current("test");
      unmount(); // Unmount the component before the delay completes
    });

    vi.advanceTimersByTime(200);

    expect(callback).not.toHaveBeenCalled();
  });
});
