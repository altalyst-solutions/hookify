import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useDebouncedCallback } from "@/hooks";

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const setup = (
  options?: Parameters<typeof useDebouncedCallback>[2],
  delay = 100
) => {
  const callback = vi.fn<(value: number) => void>();
  const hook = renderHook(
    (props: {
      cb: (value: number) => void;
      delay: number;
      options?: Parameters<typeof useDebouncedCallback>[2];
    }) => useDebouncedCallback(props.cb, props.delay, props.options),
    { initialProps: { cb: callback, delay, options } }
  );
  return { callback, ...hook };
};

describe("useDebouncedCallback", () => {
  it("does not call the callback until the delay has passed", () => {
    const { result, callback } = setup();
    result.current(1);
    advance(99);
    expect(callback).not.toHaveBeenCalled();
    advance(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(1);
  });

  it("restarts the delay on each call and uses the latest arguments", () => {
    const { result, callback } = setup();
    result.current(1);
    advance(60);
    result.current(2);
    advance(60);
    expect(callback).not.toHaveBeenCalled();
    advance(40);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(2);
  });

  it("can be called again after the callback has run", () => {
    const { result, callback } = setup();
    result.current(1);
    advance(100);
    result.current(2);
    advance(100);
    expect(callback.mock.calls).toEqual([[1], [2]]);
  });

  it("keeps a stable identity across renders and option changes", () => {
    const { result, rerender, callback } = setup();
    const first = result.current;
    rerender({ cb: vi.fn(), delay: 500, options: { leading: true } });
    rerender({ cb: callback, delay: 100, options: undefined });
    expect(result.current).toBe(first);
    expect(result.current.cancel).toBe(first.cancel);
    expect(result.current.flush).toBe(first.flush);
    expect(result.current.isPending).toBe(first.isPending);
  });

  it("invokes the latest callback without resetting the timer", () => {
    const { result, rerender } = setup();
    const next = vi.fn();
    result.current(1);
    advance(50);
    rerender({ cb: next, delay: 100, options: undefined });
    advance(50);
    expect(next).toHaveBeenCalledWith(1);
  });

  it("uses the latest delay for the next call", () => {
    const { result, rerender, callback } = setup();
    rerender({ cb: callback, delay: 300, options: undefined });
    result.current(1);
    advance(299);
    expect(callback).not.toHaveBeenCalled();
    advance(1);
    expect(callback).toHaveBeenCalledWith(1);
  });

  describe("leading and trailing", () => {
    it("calls immediately and once more when leading and trailing", () => {
      const { result, callback } = setup({ leading: true });
      result.current(1);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenLastCalledWith(1);

      result.current(2);
      result.current(3);
      expect(callback).toHaveBeenCalledTimes(1);
      advance(100);
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith(3);
    });

    it("does not repeat a leading call as trailing when called once", () => {
      const { result, callback } = setup({ leading: true });
      result.current(1);
      advance(500);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("calls immediately again after a quiet period", () => {
      const { result, callback } = setup({ leading: true });
      result.current(1);
      advance(100);
      result.current(2);
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith(2);
    });

    it("only runs the first call of a burst when trailing is false", () => {
      const { result, callback } = setup({ leading: true, trailing: false });
      result.current(1);
      result.current(2);
      advance(50);
      result.current(3);
      advance(100);
      expect(callback.mock.calls).toEqual([[1]]);
      expect(result.current.isPending()).toBe(false);

      result.current(4);
      expect(callback.mock.calls).toEqual([[1], [4]]);
    });

    it("never calls the callback when both are false", () => {
      const { result, callback } = setup({ leading: false, trailing: false });
      result.current(1);
      advance(500);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    it("discards the pending call", () => {
      const { result, callback } = setup();
      result.current(1);
      result.current.cancel();
      advance(500);
      expect(callback).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("is a no-op when nothing is pending", () => {
      const { result } = setup();
      expect(() => result.current.cancel()).not.toThrow();
    });

    it("lets later calls run normally", () => {
      const { result, callback } = setup();
      result.current(1);
      result.current.cancel();
      result.current(2);
      advance(100);
      expect(callback.mock.calls).toEqual([[2]]);
    });
  });

  describe("flush", () => {
    it("invokes the pending call immediately with the latest arguments", () => {
      const { result, callback } = setup();
      result.current(1);
      result.current(2);
      result.current.flush();
      expect(callback.mock.calls).toEqual([[2]]);
      advance(500);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("is a no-op when nothing is pending", () => {
      const { result, callback } = setup();
      result.current.flush();
      expect(callback).not.toHaveBeenCalled();
    });

    it("does not repeat a call that already ran on the leading edge", () => {
      const { result, callback } = setup({ leading: true });
      result.current(1);
      result.current.flush();
      expect(callback).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe("isPending", () => {
    it("is true while a call is waiting and false otherwise", () => {
      const { result } = setup();
      expect(result.current.isPending()).toBe(false);
      result.current(1);
      expect(result.current.isPending()).toBe(true);
      advance(100);
      expect(result.current.isPending()).toBe(false);
    });

    it("is false after cancel or flush", () => {
      const { result } = setup();
      result.current(1);
      result.current.cancel();
      expect(result.current.isPending()).toBe(false);
      result.current(1);
      result.current.flush();
      expect(result.current.isPending()).toBe(false);
    });

    it("is false after only a leading call", () => {
      const { result } = setup({ leading: true });
      result.current(1);
      expect(result.current.isPending()).toBe(false);
      result.current(2);
      expect(result.current.isPending()).toBe(true);
    });
  });

  describe("unmount", () => {
    it("discards a pending call and clears the timer", () => {
      const { result, callback, unmount } = setup();
      result.current(1);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
      advance(500);
      expect(callback).not.toHaveBeenCalled();
    });

    it("invokes a pending call with flushOnUnmount", () => {
      const { result, callback, unmount } = setup({ flushOnUnmount: true });
      result.current(1);
      unmount();
      expect(callback.mock.calls).toEqual([[1]]);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("does nothing extra with flushOnUnmount when nothing is pending", () => {
      const { callback, unmount } = setup({ flushOnUnmount: true });
      unmount();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  it("forwards multiple arguments", () => {
    const callback = vi.fn<(a: string, b: number) => void>();
    const { result } = renderHook(() => useDebouncedCallback(callback, 100));
    result.current("a", 1);
    advance(100);
    expect(callback).toHaveBeenCalledWith("a", 1);
  });

  it("behaves correctly under StrictMode", () => {
    const callback = vi.fn<(value: number) => void>();
    const { result, unmount } = renderHook(
      () => useDebouncedCallback(callback, 100, { flushOnUnmount: true }),
      { wrapper: StrictMode }
    );
    result.current(1);
    result.current(2);
    advance(100);
    expect(callback.mock.calls).toEqual([[2]]);

    result.current(3);
    unmount();
    expect(callback.mock.calls).toEqual([[2], [3]]);
  });
});
