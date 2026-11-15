import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useTimeout } from "@/hooks";

const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("useTimeout", () => {
  it("calls the callback once after the delay", () => {
    const cb = vi.fn();
    renderHook(() => useTimeout(cb, 100));

    tick(99);
    expect(cb).not.toHaveBeenCalled();
    tick(1);
    expect(cb).toHaveBeenCalledTimes(1);
    tick(1000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not run when delay is null and runs when set", () => {
    const cb = vi.fn();
    const { rerender } = renderHook(
      ({ delay }: { delay: number | null }) => useTimeout(cb, delay),
      { initialProps: { delay: null as number | null } }
    );

    tick(1000);
    expect(cb).not.toHaveBeenCalled();

    rerender({ delay: 100 });
    tick(100);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending timer when delay becomes null", () => {
    const cb = vi.fn();
    const { result, rerender } = renderHook(
      ({ delay }: { delay: number | null }) => useTimeout(cb, delay),
      { initialProps: { delay: 100 as number | null } }
    );

    tick(60);
    rerender({ delay: null });
    expect(result.current.isPending()).toBe(false);
    tick(1000);
    expect(cb).not.toHaveBeenCalled();
  });

  it("uses the latest callback without resetting the timer", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useTimeout(cb, 100), {
      initialProps: { cb: first },
    });

    tick(60);
    rerender({ cb: second });
    tick(40);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("restarts the timer when delay changes", () => {
    const cb = vi.fn();
    const { rerender } = renderHook(({ delay }) => useTimeout(cb, delay), {
      initialProps: { delay: 100 },
    });

    tick(60);
    rerender({ delay: 200 });
    tick(199);
    expect(cb).not.toHaveBeenCalled();
    tick(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not restart when re-rendered with the same delay", () => {
    const cb = vi.fn();
    const { rerender } = renderHook(({ delay }) => useTimeout(cb, delay), {
      initialProps: { delay: 100 },
    });

    tick(60);
    rerender({ delay: 100 });
    tick(40);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("clears the timer on unmount", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useTimeout(cb, 100));

    unmount();
    tick(1000);
    expect(cb).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  describe("controls", () => {
    it("returns controls with a stable identity", () => {
      const { result, rerender } = renderHook(
        ({ delay }) => useTimeout(vi.fn(), delay),
        { initialProps: { delay: 100 } }
      );
      const first = result.current;

      rerender({ delay: 200 });

      expect(result.current).toBe(first);
    });

    it("reports isPending until the callback has run", () => {
      const { result } = renderHook(() => useTimeout(vi.fn(), 100));

      expect(result.current.isPending()).toBe(true);
      tick(100);
      expect(result.current.isPending()).toBe(false);
    });

    it("cancel stops the callback from running", () => {
      const cb = vi.fn();
      const { result } = renderHook(() => useTimeout(cb, 100));

      act(() => result.current.cancel());
      expect(result.current.isPending()).toBe(false);
      tick(1000);

      expect(cb).not.toHaveBeenCalled();
    });

    it("start restarts the countdown from the full delay", () => {
      const cb = vi.fn();
      const { result } = renderHook(() => useTimeout(cb, 100));

      tick(60);
      act(() => result.current.start());
      tick(99);
      expect(cb).not.toHaveBeenCalled();
      tick(1);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("start runs the callback again after it has fired", () => {
      const cb = vi.fn();
      const { result } = renderHook(() => useTimeout(cb, 100));

      tick(100);
      act(() => result.current.start());
      tick(100);

      expect(cb).toHaveBeenCalledTimes(2);
    });

    it("start after cancel schedules a new timer", () => {
      const cb = vi.fn();
      const { result } = renderHook(() => useTimeout(cb, 100));

      act(() => result.current.cancel());
      act(() => result.current.start());
      tick(100);

      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("start does nothing while delay is null", () => {
      const cb = vi.fn();
      const { result } = renderHook(() => useTimeout(cb, null));

      act(() => result.current.start());

      expect(result.current.isPending()).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("start uses the latest delay and callback", () => {
      const first = vi.fn();
      const second = vi.fn();
      const { result, rerender } = renderHook(
        ({ cb, delay }) => useTimeout(cb, delay, { autoStart: false }),
        { initialProps: { cb: first, delay: 100 } }
      );

      rerender({ cb: second, delay: 300 });
      act(() => result.current.start());
      tick(299);
      expect(second).not.toHaveBeenCalled();
      tick(1);

      expect(second).toHaveBeenCalledTimes(1);
      expect(first).not.toHaveBeenCalled();
    });

    it("can be started from inside the callback", () => {
      let runs = 0;
      const { result } = renderHook(() =>
        useTimeout(() => {
          if (++runs < 3) result.current.start();
        }, 100)
      );

      tick(300);

      expect(runs).toBe(3);
      expect(result.current.isPending()).toBe(false);
    });
  });

  describe("autoStart: false", () => {
    it("does not start until start is called", () => {
      const cb = vi.fn();
      const { result } = renderHook(() =>
        useTimeout(cb, 100, { autoStart: false })
      );

      tick(1000);
      expect(cb).not.toHaveBeenCalled();
      expect(result.current.isPending()).toBe(false);

      act(() => result.current.start());
      expect(result.current.isPending()).toBe(true);
      tick(100);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("leaves a running timer alone when delay changes", () => {
      const cb = vi.fn();
      const { result, rerender } = renderHook(
        ({ delay }) => useTimeout(cb, delay, { autoStart: false }),
        { initialProps: { delay: 100 } }
      );

      act(() => result.current.start());
      tick(60);
      rerender({ delay: 500 });
      tick(40);

      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("clears a running timer on unmount", () => {
      const cb = vi.fn();
      const { result, unmount } = renderHook(() =>
        useTimeout(cb, 100, { autoStart: false })
      );

      act(() => result.current.start());
      unmount();
      tick(1000);

      expect(cb).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("cancels the automatic timer when switched to false", () => {
      const cb = vi.fn();
      const { rerender } = renderHook(
        ({ autoStart }) => useTimeout(cb, 100, { autoStart }),
        { initialProps: { autoStart: true } }
      );

      tick(60);
      rerender({ autoStart: false });
      tick(1000);

      expect(cb).not.toHaveBeenCalled();
    });

    it("starts automatically when switched to true", () => {
      const cb = vi.fn();
      const { rerender } = renderHook(
        ({ autoStart }) => useTimeout(cb, 100, { autoStart }),
        { initialProps: { autoStart: false } }
      );

      rerender({ autoStart: true });
      tick(100);

      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe("under StrictMode", () => {
    it("keeps a single running timer that fires once", () => {
      const cb = vi.fn();
      renderHook(() => useTimeout(cb, 100), { wrapper: StrictMode });

      expect(vi.getTimerCount()).toBe(1);
      tick(100);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("does not start a timer with autoStart: false", () => {
      const cb = vi.fn();
      renderHook(() => useTimeout(cb, 100, { autoStart: false }), {
        wrapper: StrictMode,
      });

      expect(vi.getTimerCount()).toBe(0);
      tick(1000);
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
