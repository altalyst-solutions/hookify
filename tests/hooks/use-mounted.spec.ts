import { useMounted } from "@/hooks";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("useMounted", () => {
  it("should return true when component is mounted", () => {
    const { result } = renderHook(() => useMounted());

    // After mounting, isMounted should be true
    expect(result.current()).toBe(true);
  });

  it("should return false after the component unmounts", () => {
    const { result, unmount } = renderHook(() => useMounted());

    act(() => {});
    expect(result.current()).toBe(true);

    unmount();
    expect(result.current()).toBe(false);
  });

  it("should call onMount callback when component mounts", () => {
    const onMount = vi.fn();
    renderHook(() => useMounted({ onMount }));

    expect(onMount).toHaveBeenCalledTimes(1);
  });

  it("should call onUnmount callback when component unmounts", () => {
    const onUnmount = vi.fn();
    const { unmount } = renderHook(() => useMounted({ onUnmount }));

    expect(onUnmount).not.toHaveBeenCalled();

    unmount();
    expect(onUnmount).toHaveBeenCalledTimes(1);
  });

  it("should call both onMount and onUnmount callbacks", () => {
    const onMount = vi.fn();
    const onUnmount = vi.fn();
    const { unmount } = renderHook(() => useMounted({ onMount, onUnmount }));

    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).not.toHaveBeenCalled();

    unmount();
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).toHaveBeenCalledTimes(1);
  });

  it("should call cleanup before onUnmount callback", () => {
    const callOrder: string[] = [];
    const cleanup = vi.fn(() => callOrder.push("cleanup"));
    const onMount = vi.fn(() => cleanup);
    const onUnmount = vi.fn(() => callOrder.push("onUnmount"));

    const { unmount } = renderHook(() => useMounted({ onMount, onUnmount }));

    unmount();

    expect(callOrder).toEqual(["cleanup", "onUnmount"]);
  });

  it("should work without any options", () => {
    const { result, unmount } = renderHook(() => useMounted());

    act(() => {});
    expect(result.current()).toBe(true);

    unmount();
    expect(result.current()).toBe(false);
  });

  it("should handle onMount without cleanup function", () => {
    const onMount = vi.fn(() => {
      // No cleanup returned
    });
    const { unmount } = renderHook(() => useMounted({ onMount }));

    expect(onMount).toHaveBeenCalledTimes(1);
    expect(() => unmount()).not.toThrow();
  });

  it("should prevent state updates after unmount in async operations", async () => {
    const setStateMock = vi.fn();

    const { result, unmount } = renderHook(() => useMounted());

    act(() => {});
    expect(result.current()).toBe(true);

    // Simulate async operation
    const asyncOperation = new Promise<void>((resolve) => {
      setTimeout(() => {
        if (result.current()) {
          setStateMock("data");
        }
        resolve();
      }, 100);
    });

    unmount();
    expect(result.current()).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(100);
      await asyncOperation;
    });

    expect(setStateMock).not.toHaveBeenCalled();
  });

  it("should maintain separate mounted state for multiple instances", () => {
    const { result: result1, unmount: unmount1 } = renderHook(() =>
      useMounted()
    );
    const { result: result2 } = renderHook(() => useMounted());

    act(() => {});
    expect(result1.current()).toBe(true);
    expect(result2.current()).toBe(true);

    unmount1();
    expect(result1.current()).toBe(false);
    expect(result2.current()).toBe(true);
  });

  it("should work correctly with practical use case: interval cleanup", () => {
    const callback = vi.fn();

    const { unmount } = renderHook(() =>
      useMounted({
        onMount: () => {
          const intervalId = setInterval(callback, 100);
          return () => clearInterval(intervalId);
        },
      })
    );

    vi.advanceTimersByTime(250);
    expect(callback).toHaveBeenCalledTimes(2);

    unmount();
    vi.advanceTimersByTime(200);

    // Should still be 2 because interval was cleared
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
