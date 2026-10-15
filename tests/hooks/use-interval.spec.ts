import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useInterval } from "@/hooks";

const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("useInterval", () => {
  it("calls the callback every delay", () => {
    const cb = vi.fn();
    renderHook(() => useInterval(cb, 100));

    tick(99);
    expect(cb).not.toHaveBeenCalled();
    tick(1);
    expect(cb).toHaveBeenCalledTimes(1);
    tick(200);
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it("does not run when delay is null and resumes when set", () => {
    const cb = vi.fn();
    const { rerender } = renderHook(
      ({ delay }: { delay: number | null }) => useInterval(cb, delay),
      { initialProps: { delay: null as number | null } }
    );

    tick(1000);
    expect(cb).not.toHaveBeenCalled();

    rerender({ delay: 100 });
    tick(100);
    expect(cb).toHaveBeenCalledTimes(1);

    rerender({ delay: null });
    tick(1000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("uses the latest callback without resetting the timer", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useInterval(cb, 100), {
      initialProps: { cb: first },
    });

    tick(60);
    rerender({ cb: second });
    tick(40);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("restarts the interval when delay changes", () => {
    const cb = vi.fn();
    const { rerender } = renderHook(({ delay }) => useInterval(cb, delay), {
      initialProps: { delay: 100 },
    });

    tick(60);
    rerender({ delay: 200 });
    tick(199);
    expect(cb).not.toHaveBeenCalled();
    tick(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("calls immediately when the immediate option is set", () => {
    const cb = vi.fn();
    const { rerender } = renderHook(
      ({ delay }: { delay: number | null }) =>
        useInterval(cb, delay, { immediate: true }),
      { initialProps: { delay: null as number | null } }
    );

    expect(cb).not.toHaveBeenCalled();
    rerender({ delay: 100 });
    expect(cb).toHaveBeenCalledTimes(1);
    tick(100);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("does not call immediately by default", () => {
    const cb = vi.fn();
    renderHook(() => useInterval(cb, 100));
    expect(cb).not.toHaveBeenCalled();
  });

  it("clears the interval on unmount", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useInterval(cb, 100));

    unmount();
    tick(1000);
    expect(cb).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps a single running interval under StrictMode", () => {
    const cb = vi.fn();
    renderHook(() => useInterval(cb, 100), { wrapper: StrictMode });

    expect(vi.getTimerCount()).toBe(1);
    tick(100);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
