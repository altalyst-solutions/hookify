import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useThrottle } from "@/hooks";

const setup = (
  options?: Parameters<typeof useThrottle<number>>[2],
  delay = 100
) =>
  renderHook(({ value }) => useThrottle(value, delay, options), {
    initialProps: { value: 0 },
  });

describe("useThrottle", () => {
  it("returns the initial value on first render", () => {
    const { result } = setup();
    expect(result.current).toBe(0);
  });

  it("emits the first change immediately (leading)", () => {
    const { result, rerender } = setup();
    rerender({ value: 1 });
    expect(result.current).toBe(1);
  });

  it("emits at most one update per window, ending with the latest value", () => {
    const { result, rerender } = setup();
    rerender({ value: 1 });
    rerender({ value: 2 });
    rerender({ value: 3 });
    expect(result.current).toBe(1);

    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(result.current).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(3);
  });

  it("keeps throttling after a trailing emit", () => {
    const { result, rerender } = setup();
    rerender({ value: 1 });
    rerender({ value: 2 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(2);

    rerender({ value: 3 });
    expect(result.current).toBe(2);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(3);
  });

  it("emits immediately again once a quiet window has passed", () => {
    const { result, rerender } = setup();
    rerender({ value: 1 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: 2 });
    expect(result.current).toBe(2);
  });

  it("skips the leading emit when leading is false", () => {
    const { result, rerender } = setup({ leading: false });
    rerender({ value: 1 });
    expect(result.current).toBe(0);
    rerender({ value: 2 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(2);
  });

  it("skips the trailing emit when trailing is false", () => {
    const { result, rerender } = setup({ trailing: false });
    rerender({ value: 1 });
    rerender({ value: 2 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(1);

    rerender({ value: 3 });
    expect(result.current).toBe(3);
  });

  it("never updates when both leading and trailing are false", () => {
    const { result, rerender } = setup({ leading: false, trailing: false });
    rerender({ value: 1 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(0);
  });

  it("works with non-primitive values", () => {
    const a = { id: 1 };
    const b = { id: 2 };
    const { result, rerender } = renderHook(
      ({ value }) => useThrottle(value, 100),
      { initialProps: { value: a } }
    );
    rerender({ value: b });
    expect(result.current).toBe(b);
  });

  it("uses the latest delay for the next window", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useThrottle(value, delay),
      { initialProps: { value: 0, delay: 100 } }
    );
    rerender({ value: 1, delay: 300 });
    rerender({ value: 2, delay: 300 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(1);
  });

  it("clears pending timers on unmount", () => {
    const { rerender, unmount } = setup();
    rerender({ value: 1 });
    rerender({ value: 2 });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("behaves correctly under StrictMode", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottle(value, 100),
      { initialProps: { value: 0 }, wrapper: StrictMode }
    );
    expect(result.current).toBe(0);
    rerender({ value: 1 });
    rerender({ value: 2 });
    expect(result.current).toBe(1);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(2);
  });
});
