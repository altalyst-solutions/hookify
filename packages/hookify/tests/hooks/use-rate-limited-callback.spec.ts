import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  useRateLimitedCallback,
  type UseRateLimitedCallbackOptions,
} from "@/hooks";

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe("useRateLimitedCallback", () => {
  it("runs up to `limit` calls immediately and drops the rest", () => {
    const callback = vi.fn();
    const onLimited = vi.fn();
    const { result } = renderHook(() =>
      useRateLimitedCallback(callback, { limit: 3, windowMs: 1000, onLimited })
    );

    const results = [1, 2, 3, 4, 5].map((n) => result.current(n));

    expect(results).toEqual([true, true, true, false, false]);
    expect(callback.mock.calls).toEqual([[1], [2], [3]]);
    expect(onLimited.mock.calls).toEqual([[4], [5]]);
    expect(result.current.remaining()).toBe(0);
    expect(result.current.pending()).toBe(0);
  });

  it("refills tokens smoothly at limit / windowMs", () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useRateLimitedCallback(callback, { limit: 2, windowMs: 1000 })
    );

    result.current();
    result.current();
    expect(result.current()).toBe(false);

    advance(499);
    expect(result.current.remaining()).toBe(0);
    expect(result.current()).toBe(false);

    advance(1);
    expect(result.current.remaining()).toBe(1);
    expect(result.current()).toBe(true);
    expect(result.current()).toBe(false);
    expect(callback).toHaveBeenCalledTimes(3);

    advance(10_000);
    expect(result.current.remaining()).toBe(2);
  });

  it("starts with a full bucket and never exceeds `limit`", () => {
    const { result } = renderHook(() =>
      useRateLimitedCallback(vi.fn(), { limit: 4, windowMs: 1000 })
    );

    expect(result.current.remaining()).toBe(4);
    advance(60_000);
    expect(result.current.remaining()).toBe(4);
  });

  describe("overflow: queue", () => {
    it("runs queued calls in order as tokens refill", () => {
      const callback = vi.fn();
      const onLimited = vi.fn();
      const { result } = renderHook(() =>
        useRateLimitedCallback(callback, {
          limit: 1,
          windowMs: 1000,
          overflow: "queue",
          onLimited,
        })
      );

      expect([1, 2, 3].map((n) => result.current(n))).toEqual([
        true,
        true,
        true,
      ]);
      expect(callback.mock.calls).toEqual([[1]]);
      expect(result.current.pending()).toBe(2);

      advance(999);
      expect(callback).toHaveBeenCalledTimes(1);
      advance(1);
      expect(callback.mock.calls).toEqual([[1], [2]]);
      expect(result.current.pending()).toBe(1);

      advance(1000);
      expect(callback.mock.calls).toEqual([[1], [2], [3]]);
      expect(result.current.pending()).toBe(0);
      expect(onLimited).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("drains a burst of queued calls as soon as several tokens are back", () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        useRateLimitedCallback(callback, {
          limit: 3,
          windowMs: 3000,
          overflow: "queue",
        })
      );

      for (let n = 0; n < 7; n++) result.current(n);
      expect(callback).toHaveBeenCalledTimes(3);

      advance(1000);
      expect(callback).toHaveBeenCalledTimes(4);
      advance(2000);
      expect(callback).toHaveBeenCalledTimes(6);
      advance(1000);
      expect(callback).toHaveBeenCalledTimes(7);
    });

    it("keeps order: a new call waits behind the queue even if a token is free", () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        useRateLimitedCallback(callback, {
          limit: 1,
          windowMs: 1000,
          overflow: "queue",
        })
      );

      result.current("a");
      result.current("b");
      advance(1000);
      result.current("c");

      expect(callback.mock.calls).toEqual([["a"], ["b"]]);
      advance(1000);
      expect(callback.mock.calls).toEqual([["a"], ["b"], ["c"]]);
    });

    it("drops calls beyond `maxQueue` and reports them to `onLimited`", () => {
      const callback = vi.fn();
      const onLimited = vi.fn();
      const { result } = renderHook(() =>
        useRateLimitedCallback(callback, {
          limit: 1,
          windowMs: 1000,
          overflow: "queue",
          maxQueue: 1,
          onLimited,
        })
      );

      expect([1, 2, 3].map((n) => result.current(n))).toEqual([
        true,
        true,
        false,
      ]);
      expect(onLimited.mock.calls).toEqual([[3]]);

      advance(1000);
      expect(callback.mock.calls).toEqual([[1], [2]]);
    });

    it("drops every excess call when `maxQueue` is 0", () => {
      const { result } = renderHook(() =>
        useRateLimitedCallback(vi.fn(), {
          limit: 1,
          windowMs: 1000,
          overflow: "queue",
          maxQueue: 0,
        })
      );

      expect(result.current()).toBe(true);
      expect(result.current()).toBe(false);
      expect(result.current.pending()).toBe(0);
    });

    it("cancel discards queued calls without refunding tokens", () => {
      const callback = vi.fn();
      const onLimited = vi.fn();
      const { result } = renderHook(() =>
        useRateLimitedCallback(callback, {
          limit: 1,
          windowMs: 1000,
          overflow: "queue",
          onLimited,
        })
      );

      result.current(1);
      result.current(2);
      result.current(3);
      act(() => result.current.cancel());

      expect(result.current.pending()).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      expect(result.current.remaining()).toBe(0);
      advance(5000);
      expect(callback.mock.calls).toEqual([[1]]);
      expect(onLimited).not.toHaveBeenCalled();
      expect(result.current("next")).toBe(true);
    });

    it("keeps draining when a queued callback throws", () => {
      const callback = vi.fn((n: number) => {
        if (n === 2) throw new Error("boom");
      });
      const { result } = renderHook(() =>
        useRateLimitedCallback(callback, {
          limit: 1,
          windowMs: 1000,
          overflow: "queue",
        })
      );

      result.current(1);
      result.current(2);
      result.current(3);

      expect(() => advance(1000)).toThrow("boom");
      advance(1000);
      expect(callback.mock.calls).toEqual([[1], [2], [3]]);
    });
  });

  describe("invalid options", () => {
    it.each([0, 0.5, -1, NaN])(
      "never runs the callback when `limit` is %s, even when queueing",
      (limit) => {
        const callback = vi.fn();
        const onLimited = vi.fn();
        const { result } = renderHook(() =>
          useRateLimitedCallback(callback, {
            limit,
            windowMs: 1000,
            overflow: "queue",
            onLimited,
          })
        );

        expect(result.current()).toBe(false);
        advance(10_000);
        expect(callback).not.toHaveBeenCalled();
        expect(onLimited).toHaveBeenCalledTimes(1);
        expect(result.current.remaining()).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
      }
    );

    it("rounds a fractional `limit` down", () => {
      const { result } = renderHook(() =>
        useRateLimitedCallback(vi.fn(), { limit: 2.9, windowMs: 1000 })
      );

      expect(result.current.remaining()).toBe(2);
    });

    it.each([0, -5, NaN])(
      "does not limit when `windowMs` is %s",
      (windowMs) => {
        const callback = vi.fn();
        const { result } = renderHook(() =>
          useRateLimitedCallback(callback, { limit: 1, windowMs })
        );

        for (let n = 0; n < 5; n++) expect(result.current()).toBe(true);
        expect(callback).toHaveBeenCalledTimes(5);
      }
    );

    it("never refills when `windowMs` is Infinity, and sets no timer", () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        useRateLimitedCallback(callback, {
          limit: 1,
          windowMs: Infinity,
          overflow: "queue",
        })
      );

      result.current(1);
      result.current(2);
      advance(1_000_000);

      expect(callback.mock.calls).toEqual([[1]]);
      expect(result.current.pending()).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("does not limit when `limit` is Infinity", () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        useRateLimitedCallback(callback, { limit: Infinity, windowMs: 1000 })
      );

      for (let n = 0; n < 100; n++) expect(result.current()).toBe(true);
      advance(1000);
      expect(result.current()).toBe(true);
      expect(result.current.remaining()).toBe(Infinity);
    });

    it("clamps very long waits so the timer does not fire immediately", () => {
      const callback = vi.fn();
      const { result } = renderHook(() =>
        useRateLimitedCallback(callback, {
          limit: 1,
          windowMs: 2 ** 40,
          overflow: "queue",
        })
      );

      result.current(1);
      result.current(2);
      advance(10_000);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(1);
    });
  });

  describe("latest values and identity", () => {
    it("keeps the same function identity across renders", () => {
      const { result, rerender } = renderHook(
        ({ limit }) =>
          useRateLimitedCallback(vi.fn(), { limit, windowMs: 1000 }),
        { initialProps: { limit: 1 } }
      );
      const first = result.current;

      rerender({ limit: 5 });

      expect(result.current).toBe(first);
      expect(result.current.cancel).toBe(first.cancel);
      expect(result.current.remaining).toBe(first.remaining);
      expect(result.current.pending).toBe(first.pending);
    });

    it("always runs the latest callback, including queued calls", () => {
      const first = vi.fn();
      const second = vi.fn();
      const { result, rerender } = renderHook(
        ({ callback }) =>
          useRateLimitedCallback(callback, {
            limit: 1,
            windowMs: 1000,
            overflow: "queue",
          }),
        { initialProps: { callback: first } }
      );

      result.current("a");
      result.current("b");
      rerender({ callback: second });
      advance(1000);

      expect(first.mock.calls).toEqual([["a"]]);
      expect(second.mock.calls).toEqual([["b"]]);
    });

    it("applies a new `limit` from the next refill without resetting spent tokens", () => {
      const callback = vi.fn();
      const { result, rerender } = renderHook(
        ({ limit }: { limit: number }) =>
          useRateLimitedCallback(callback, { limit, windowMs: 1000 }),
        { initialProps: { limit: 1 } }
      );

      result.current();
      expect(result.current()).toBe(false);

      rerender({ limit: 4 });
      expect(result.current.remaining()).toBe(0);

      advance(250);
      expect(result.current.remaining()).toBe(1);
      advance(750);
      expect(result.current.remaining()).toBe(4);
    });

    it("uses a new `limit` that is lower right away", () => {
      const { result, rerender } = renderHook(
        ({ limit }: { limit: number }) =>
          useRateLimitedCallback(vi.fn(), { limit, windowMs: 1000 }),
        { initialProps: { limit: 5 } }
      );

      result.current();
      rerender({ limit: 2 });

      expect(result.current.remaining()).toBe(2);
    });

    it("reschedules a pending drain when `windowMs` changes", () => {
      const callback = vi.fn();
      const { result, rerender } = renderHook(
        ({ windowMs }: { windowMs: number }) =>
          useRateLimitedCallback(callback, {
            limit: 1,
            windowMs,
            overflow: "queue",
          }),
        { initialProps: { windowMs: 1000 } }
      );

      result.current(1);
      result.current(2);
      rerender({ windowMs: 4000 });

      advance(1000);
      expect(callback).toHaveBeenCalledTimes(1);
      advance(3000);
      expect(callback.mock.calls).toEqual([[1], [2]]);
    });

    it("reads `onLimited` and `overflow` from the latest options", () => {
      const first = vi.fn();
      const second = vi.fn();
      const { result, rerender } = renderHook(
        (props: Partial<UseRateLimitedCallbackOptions>) =>
          useRateLimitedCallback(vi.fn(), {
            limit: 1,
            windowMs: 1000,
            ...props,
          }),
        {
          initialProps: {
            onLimited: first,
          } as Partial<UseRateLimitedCallbackOptions>,
        }
      );

      result.current();
      result.current();
      rerender({ onLimited: second });
      result.current();
      rerender({ onLimited: second, overflow: "queue" });

      expect(result.current()).toBe(true);
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
      expect(result.current.pending()).toBe(1);
    });
  });

  describe("unmount", () => {
    it("clears the queue and timer and never calls the callback afterwards", () => {
      const callback = vi.fn();
      const { result, unmount } = renderHook(() =>
        useRateLimitedCallback(callback, {
          limit: 1,
          windowMs: 1000,
          overflow: "queue",
        })
      );

      result.current(1);
      result.current(2);
      result.current(3);
      unmount();

      expect(vi.getTimerCount()).toBe(0);
      expect(result.current.pending()).toBe(0);
      advance(10_000);
      expect(callback.mock.calls).toEqual([[1]]);
    });

    it("ignores calls made after unmount", () => {
      const callback = vi.fn();
      const onLimited = vi.fn();
      const { result, unmount } = renderHook(() =>
        useRateLimitedCallback(callback, {
          limit: 5,
          windowMs: 1000,
          overflow: "queue",
          onLimited,
        })
      );

      unmount();

      expect(result.current("late")).toBe(false);
      expect(callback).not.toHaveBeenCalled();
      expect(onLimited).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("keeps working through StrictMode's simulated unmount", () => {
      const callback = vi.fn();
      const { result } = renderHook(
        () =>
          useRateLimitedCallback(callback, {
            limit: 1,
            windowMs: 1000,
            overflow: "queue",
          }),
        { reactStrictMode: true }
      );

      result.current(1);
      result.current(2);
      advance(1000);

      expect(callback.mock.calls).toEqual([[1], [2]]);
    });
  });

  it("can be called from inside the callback without corrupting state", () => {
    const calls: number[] = [];
    const { result } = renderHook(() => {
      const limited = useRateLimitedCallback(
        (n: number) => {
          calls.push(n);
          if (n < 3) limited(n + 1);
        },
        { limit: 2, windowMs: 1000 }
      );
      return limited;
    });

    result.current(1);

    expect(calls).toEqual([1, 2]);
    expect(result.current.remaining()).toBe(0);
  });
});
