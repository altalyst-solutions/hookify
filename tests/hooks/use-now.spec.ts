import { act, renderHook } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNow } from "@/hooks";

const START = new Date("2026-01-01T00:00:00.000Z").getTime();

describe("useNow", () => {
  let visibilityState: DocumentVisibilityState;

  const setVisibility = (state: DocumentVisibilityState) => {
    act(() => {
      visibilityState = state;
      document.dispatchEvent(new Event("visibilitychange"));
    });
  };

  beforeEach(() => {
    visibilityState = "visible";
    // `restoreMocks` in vitest.config.ts restores the real getter after each test.
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibilityState
    );
    vi.setSystemTime(START);
  });

  describe("value", () => {
    it("returns the current time", () => {
      const { result } = renderHook(() => useNow());

      expect(result.current).toBe(START);
    });

    it("updates every second by default", () => {
      const { result } = renderHook(() => useNow());

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current).toBe(START + 1000);

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(result.current).toBe(START + 3000);
    });

    it("updates at a custom interval", () => {
      const { result } = renderHook(() => useNow({ intervalMs: 5000 }));

      act(() => {
        vi.advanceTimersByTime(4999);
      });
      expect(result.current).toBe(START);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current).toBe(START + 5000);
    });

    it("re-renders once per tick", () => {
      let renders = 0;
      renderHook(() => {
        renders++;
        return useNow({ intervalMs: 1000 });
      });
      const initial = renders;

      for (let i = 0; i < 3; i++) {
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }

      expect(renders - initial).toBe(3);
    });

    it("starts a timer on mount without an extra render", () => {
      let renders = 0;
      renderHook(() => {
        renders++;
        return useNow();
      });

      expect(renders).toBe(1);
    });

    it("keeps the same value across re-renders between ticks", () => {
      const { result, rerender } = renderHook(() => useNow());
      const first = result.current;

      act(() => {
        vi.advanceTimersByTime(500);
      });
      rerender();

      expect(result.current).toBe(first);
    });
  });

  describe("shared timer", () => {
    it("uses one timer for many consumers with the same interval", () => {
      const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

      const hooks = Array.from({ length: 50 }, () =>
        renderHook(() => useNow({ intervalMs: 1000 }))
      );

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(1);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      hooks.forEach(({ result }) => {
        expect(result.current).toBe(START + 1000);
      });
    });

    it("uses separate timers for different intervals", () => {
      const fast = renderHook(() => useNow({ intervalMs: 1000 }));
      const slow = renderHook(() => useNow({ intervalMs: 5000 }));

      expect(vi.getTimerCount()).toBe(2);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(fast.result.current).toBe(START + 1000);
      expect(slow.result.current).toBe(START);
    });

    it("stops the timer with the last consumer", () => {
      const first = renderHook(() => useNow());
      const second = renderHook(() => useNow());
      expect(vi.getTimerCount()).toBe(1);

      first.unmount();
      expect(vi.getTimerCount()).toBe(1);

      second.unmount();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("lets a consumer that mounts later join the running timer", () => {
      const first = renderHook(() => useNow());
      act(() => {
        vi.advanceTimersByTime(400);
      });

      const second = renderHook(() => useNow());
      expect(vi.getTimerCount()).toBe(1);
      expect(second.result.current).toBe(first.result.current);

      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(first.result.current).toBe(START + 1000);
      expect(second.result.current).toBe(START + 1000);
    });

    it("starts a fresh timer after every consumer unmounted", () => {
      renderHook(() => useNow()).unmount();
      expect(vi.getTimerCount()).toBe(0);

      vi.setSystemTime(START + 60_000);
      const { result } = renderHook(() => useNow());

      expect(vi.getTimerCount()).toBe(1);
      expect(result.current).toBe(START + 60_000);
    });
  });

  describe("pauseWhenHidden", () => {
    it("stops ticking while the document is hidden", () => {
      const { result } = renderHook(() => useNow());

      setVisibility("hidden");
      expect(vi.getTimerCount()).toBe(0);

      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(result.current).toBe(START);
    });

    it("refreshes immediately and resumes when the document is visible again", () => {
      const { result } = renderHook(() => useNow());

      setVisibility("hidden");
      vi.setSystemTime(START + 10_000);
      setVisibility("visible");

      expect(result.current).toBe(START + 10_000);
      expect(vi.getTimerCount()).toBe(1);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current).toBe(START + 11_000);
    });

    it("does not start a timer when mounted while hidden", () => {
      visibilityState = "hidden";
      const { result } = renderHook(() => useNow());

      expect(vi.getTimerCount()).toBe(0);
      expect(result.current).toBe(START);

      vi.setSystemTime(START + 5000);
      setVisibility("visible");

      expect(result.current).toBe(START + 5000);
      expect(vi.getTimerCount()).toBe(1);
    });

    it("gives a consumer that mounts while hidden a current time", () => {
      const first = renderHook(() => useNow());
      setVisibility("hidden");

      vi.setSystemTime(START + 60_000);
      const second = renderHook(() => useNow());

      expect(second.result.current).toBe(START + 60_000);
      expect(first.result.current).toBe(START);
    });

    it("keeps ticking while hidden when disabled", () => {
      const { result } = renderHook(() => useNow({ pauseWhenHidden: false }));

      setVisibility("hidden");
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current).toBe(START + 2000);
    });

    it("does not listen for visibility changes when disabled", () => {
      const addSpy = vi.spyOn(document, "addEventListener");
      renderHook(() => useNow({ pauseWhenHidden: false }));

      expect(addSpy).not.toHaveBeenCalledWith(
        "visibilitychange",
        expect.anything()
      );
    });

    it("keeps consumers with different settings independent", () => {
      const pausing = renderHook(() => useNow());
      const running = renderHook(() => useNow({ pauseWhenHidden: false }));
      expect(vi.getTimerCount()).toBe(2);

      setVisibility("hidden");
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(pausing.result.current).toBe(START);
      expect(running.result.current).toBe(START + 1000);
    });

    it("removes the visibility listener on unmount", () => {
      const removeSpy = vi.spyOn(document, "removeEventListener");
      const { unmount } = renderHook(() => useNow());

      unmount();

      expect(removeSpy).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function)
      );
    });
  });

  describe("enabled", () => {
    it("does not start a timer when disabled", () => {
      const { result } = renderHook(() => useNow({ enabled: false }));

      expect(vi.getTimerCount()).toBe(0);
      expect(result.current).toBe(START);

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(result.current).toBe(START);
    });

    it("freezes the value and stops the timer when disabled", () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useNow({ enabled }),
        { initialProps: { enabled: true } }
      );

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(result.current).toBe(START + 3000);

      rerender({ enabled: false });
      expect(vi.getTimerCount()).toBe(0);

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      rerender({ enabled: false });
      expect(result.current).toBe(START + 3000);
    });

    it("resumes with the current time when enabled again", () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useNow({ enabled }),
        { initialProps: { enabled: false } }
      );

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      rerender({ enabled: true });

      expect(vi.getTimerCount()).toBe(1);
      expect(result.current).toBe(START + 5000);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current).toBe(START + 6000);
    });

    it("leaves other consumers running when one is disabled", () => {
      const active = renderHook(() => useNow());
      const paused = renderHook(() => useNow({ enabled: false }));

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(active.result.current).toBe(START + 2000);
      expect(paused.result.current).toBe(START);
      expect(vi.getTimerCount()).toBe(1);
    });
  });

  describe("options changes", () => {
    it("moves to the new interval when intervalMs changes", () => {
      const { result, rerender } = renderHook(
        ({ intervalMs }) => useNow({ intervalMs }),
        { initialProps: { intervalMs: 1000 } }
      );

      rerender({ intervalMs: 10_000 });
      expect(vi.getTimerCount()).toBe(1);

      act(() => {
        vi.advanceTimersByTime(9000);
      });
      expect(result.current).toBe(START);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current).toBe(START + 10_000);
    });

    it("does not resubscribe on re-render with the same options", () => {
      const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
      const { rerender } = renderHook(() => useNow({ intervalMs: 1000 }));

      rerender();
      rerender();

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it.each([0, -5, NaN, Infinity])(
      "falls back to one second for an interval of %s",
      (intervalMs) => {
        const { result } = renderHook(() => useNow({ intervalMs }));

        act(() => {
          vi.advanceTimersByTime(1000);
        });

        expect(result.current).toBe(START + 1000);
      }
    );

    it("caps an interval too large for setInterval", () => {
      const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
      renderHook(() => useNow({ intervalMs: Number.MAX_SAFE_INTEGER }));

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        2_147_483_647
      );
    });
  });

  describe("unmount", () => {
    it("clears the timer and does not update after unmount", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { unmount } = renderHook(() => useNow());

      unmount();
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(vi.getTimerCount()).toBe(0);
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe("StrictMode", () => {
    it("keeps a single working timer", () => {
      const { result, unmount } = renderHook(() => useNow(), {
        reactStrictMode: true,
      });
      expect(vi.getTimerCount()).toBe(1);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current).toBe(START + 1000);

      unmount();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("does not warn about uncached snapshots when disabled", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { rerender } = renderHook(() => useNow({ enabled: false }), {
        reactStrictMode: true,
      });

      vi.advanceTimersByTime(5000);
      rerender();

      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe("server rendering", () => {
    const Time = ({ serverNow }: { serverNow?: number }) =>
      createElement("time", null, String(useNow({ serverNow })));

    it("renders the current time on the server", () => {
      expect(renderToString(createElement(Time))).toContain(String(START));
    });

    it("renders serverNow on the server when given", () => {
      expect(renderToString(createElement(Time, { serverNow: 42 }))).toContain(
        ">42<"
      );
    });

    it("hydrates serverNow without a mismatch, then shows the current time", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const container = document.createElement("div");
      document.body.appendChild(container);
      container.innerHTML = renderToString(
        createElement(Time, { serverNow: 42 })
      );

      let root!: ReturnType<typeof hydrateRoot>;
      await act(async () => {
        root = hydrateRoot(
          container,
          createElement(
            StrictMode,
            null,
            createElement(Time, { serverNow: 42 })
          )
        );
      });

      expect(errorSpy).not.toHaveBeenCalled();
      expect(container.textContent).toBe(String(START));

      act(() => root.unmount());
      container.remove();
    });
  });
});
