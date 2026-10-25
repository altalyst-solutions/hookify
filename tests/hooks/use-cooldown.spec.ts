import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCooldown } from "@/hooks";

// Advance in separate acts so React re-arms the timer between ticks.
const tick = (ms: number) => {
  let left = ms;
  while (left > 0) {
    const step = Math.min(left, 500);
    act(() => {
      vi.advanceTimersByTime(step);
    });
    left -= step;
  }
};

describe("useCooldown", () => {
  it("is idle until started", () => {
    const { result } = renderHook(() => useCooldown(3));

    expect(result.current.remaining).toBe(0);
    expect(result.current.isActive).toBe(false);
    tick(5000);
    expect(result.current.remaining).toBe(0);
  });

  it("counts down once per second and goes idle at zero", () => {
    const { result } = renderHook(() => useCooldown(3));

    act(() => result.current.start());
    expect(result.current.remaining).toBe(3);
    expect(result.current.isActive).toBe(true);

    tick(999);
    expect(result.current.remaining).toBe(3);
    tick(1);
    expect(result.current.remaining).toBe(2);
    tick(2000);
    expect(result.current.remaining).toBe(0);
    expect(result.current.isActive).toBe(false);
  });

  it("restarts from the full duration when started while running", () => {
    const { result } = renderHook(() => useCooldown(3));

    act(() => result.current.start());
    tick(2500);
    expect(result.current.remaining).toBe(1);

    act(() => result.current.start());
    expect(result.current.remaining).toBe(3);
    // The partial second that had elapsed is discarded.
    tick(999);
    expect(result.current.remaining).toBe(3);
    tick(1);
    expect(result.current.remaining).toBe(2);
  });

  it("restarts even when remaining is unchanged", () => {
    const { result } = renderHook(() => useCooldown(3));

    act(() => result.current.start());
    tick(500);
    act(() => result.current.start());
    tick(500);
    expect(result.current.remaining).toBe(3);
    tick(500);
    expect(result.current.remaining).toBe(2);
  });

  it("start accepts a one-off override", () => {
    const { result } = renderHook(() => useCooldown(3));

    act(() => result.current.start(10));
    expect(result.current.remaining).toBe(10);

    act(() => result.current.start());
    expect(result.current.remaining).toBe(3);
  });

  it("uses the latest seconds on the next start", () => {
    const { result, rerender } = renderHook(({ s }) => useCooldown(s), {
      initialProps: { s: 3 },
    });

    act(() => result.current.start());
    rerender({ s: 8 });
    expect(result.current.remaining).toBe(3);
    tick(1000);
    expect(result.current.remaining).toBe(2);

    act(() => result.current.start());
    expect(result.current.remaining).toBe(8);
  });

  it("keeps start and reset referentially stable", () => {
    const { result, rerender } = renderHook(({ s }) => useCooldown(s), {
      initialProps: { s: 3 },
    });
    const { start, reset } = result.current;

    rerender({ s: 9 });
    act(() => start());
    tick(1000);

    expect(result.current.start).toBe(start);
    expect(result.current.reset).toBe(reset);
  });

  it("reset stops the countdown without calling onComplete", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useCooldown(3, { onComplete }));

    act(() => result.current.start());
    tick(1000);
    act(() => result.current.reset());
    expect(result.current.remaining).toBe(0);

    tick(5000);
    expect(result.current.remaining).toBe(0);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("calls onComplete once when the countdown finishes", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useCooldown(2, { onComplete }));

    act(() => result.current.start());
    tick(1000);
    expect(onComplete).not.toHaveBeenCalled();
    tick(1000);
    expect(onComplete).toHaveBeenCalledTimes(1);
    tick(5000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("always calls the latest onComplete", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useCooldown(2, { onComplete: cb }),
      { initialProps: { cb: first } }
    );

    act(() => result.current.start());
    rerender({ cb: second });
    tick(2000);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("starts on mount with autoStart", () => {
    const { result } = renderHook(() => useCooldown(2, { autoStart: true }));

    expect(result.current.remaining).toBe(2);
    tick(2000);
    expect(result.current.remaining).toBe(0);
  });

  it("rounds up fractions and treats invalid values as no cooldown", () => {
    const { result } = renderHook(() => useCooldown(1.2));

    act(() => result.current.start());
    expect(result.current.remaining).toBe(2);

    for (const bad of [0, -5, NaN, Infinity]) {
      act(() => result.current.start(bad));
      expect(result.current.remaining).toBe(0);
    }
  });

  it("does not call onComplete after unmount", () => {
    const onComplete = vi.fn();
    const { result, unmount } = renderHook(() =>
      useCooldown(2, { onComplete })
    );

    act(() => result.current.start());
    unmount();
    tick(5000);

    expect(onComplete).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("counts down correctly under StrictMode", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useCooldown(2, { onComplete }), {
      reactStrictMode: true,
    });

    act(() => result.current.start());
    tick(1000);
    expect(result.current.remaining).toBe(1);
    tick(1000);
    expect(result.current.remaining).toBe(0);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
