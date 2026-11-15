import { act, render, renderHook } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useImpression } from "@/hooks";

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  observed: Element[] = [];
  disconnected = false;

  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly init: IntersectionObserverInit = {}
  ) {
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    this.observed.push(target);
  }

  unobserve() {}

  disconnect() {
    this.disconnected = true;
  }
}

const live = () =>
  MockIntersectionObserver.instances.filter((o) => !o.disconnected);

const makeEntry = (
  target: Element,
  intersectionRatio: number
): IntersectionObserverEntry =>
  ({
    target,
    isIntersecting: intersectionRatio > 0,
    intersectionRatio,
  }) as unknown as IntersectionObserverEntry;

const notify = (observer: MockIntersectionObserver, ratio: number) => {
  const entry = makeEntry(observer.observed[0], ratio);
  act(() => {
    observer.callback([entry], observer as unknown as IntersectionObserver);
  });
  return entry;
};

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("useImpression", () => {
  let visibilityState: DocumentVisibilityState;

  const setVisibility = (state: DocumentVisibilityState) => {
    act(() => {
      visibilityState = state;
      document.dispatchEvent(new Event("visibilitychange"));
    });
  };

  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    visibilityState = "visible";
    // `restoreMocks` in vitest.config.ts restores the real getter after each test.
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibilityState
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const setup = (
    options?: Parameters<typeof useImpression>[1],
    onImpression = vi.fn()
  ) => {
    const el = document.createElement("div");
    const hook = renderHook(
      (props: { options?: Parameters<typeof useImpression>[1] }) =>
        useImpression(onImpression, props.options),
      { initialProps: { options } }
    );
    act(() => hook.result.current(el));
    return { ...hook, el, onImpression };
  };

  it("returns a stable ref and does not observe until an element is attached", () => {
    const { result, rerender } = renderHook(() => useImpression(vi.fn()));
    const ref = result.current;

    expect(MockIntersectionObserver.instances).toHaveLength(0);
    rerender();
    expect(result.current).toBe(ref);
  });

  it("observes with a default threshold of 0.5 in the browser viewport", () => {
    const { el } = setup();

    expect(live()[0].observed).toEqual([el]);
    expect(live()[0].init).toEqual({
      root: null,
      rootMargin: "0px",
      threshold: 0.5,
    });
  });

  it("calls the callback once after 1 second of visibility by default", () => {
    const { onImpression } = setup();

    const entry = notify(live()[0], 0.6);
    advance(999);
    expect(onImpression).not.toHaveBeenCalled();

    advance(1);
    expect(onImpression).toHaveBeenCalledTimes(1);
    expect(onImpression).toHaveBeenCalledWith(entry);
  });

  it("does not start the timer below the threshold", () => {
    const { onImpression } = setup();

    notify(live()[0], 0.4);
    advance(5000);

    expect(onImpression).not.toHaveBeenCalled();
  });

  it("resets the timer when the element leaves before the duration", () => {
    const { onImpression } = setup({ minDurationMs: 1000 });

    notify(live()[0], 1);
    advance(800);
    notify(live()[0], 0);
    advance(5000);
    expect(onImpression).not.toHaveBeenCalled();

    notify(live()[0], 1);
    advance(800);
    expect(onImpression).not.toHaveBeenCalled();
    advance(200);
    expect(onImpression).toHaveBeenCalledTimes(1);
  });

  it("keeps the timer running when visibility changes but stays above the threshold", () => {
    const { onImpression } = setup({ threshold: 0.5, minDurationMs: 1000 });

    notify(live()[0], 0.6);
    advance(500);
    notify(live()[0], 1);
    advance(500);

    expect(onImpression).toHaveBeenCalledTimes(1);
  });

  it("uses the entry that was latest when the timer fired", () => {
    const { onImpression } = setup();

    notify(live()[0], 0.6);
    advance(500);
    const latest = notify(live()[0], 0.9);
    advance(500);

    expect(onImpression).toHaveBeenCalledWith(latest);
  });

  describe("options", () => {
    it("passes root, rootMargin and threshold to the observer", () => {
      const root = document.createElement("section");
      setup({ root, rootMargin: "10px", threshold: 0.25 });

      expect(live()[0].init).toEqual({
        root,
        rootMargin: "10px",
        threshold: 0.25,
      });
    });

    it("respects a custom minDurationMs", () => {
      const { onImpression } = setup({ minDurationMs: 250 });

      notify(live()[0], 1);
      advance(249);
      expect(onImpression).not.toHaveBeenCalled();
      advance(1);
      expect(onImpression).toHaveBeenCalledTimes(1);
    });

    it("reports as soon as the element is visible with minDurationMs 0", () => {
      const { onImpression } = setup({ minDurationMs: 0 });

      notify(live()[0], 1);
      advance(0);

      expect(onImpression).toHaveBeenCalledTimes(1);
    });

    it("clamps the threshold and falls back for an invalid duration", () => {
      setup({ threshold: 3, minDurationMs: -5 });
      expect(live()[0].init.threshold).toBe(1);

      const { onImpression } = setup({
        threshold: Number.NaN,
        minDurationMs: Number.NaN,
      });
      expect(live()[1].init.threshold).toBe(0.5);

      notify(live()[1], 1);
      advance(999);
      expect(onImpression).not.toHaveBeenCalled();
      advance(1);
      expect(onImpression).toHaveBeenCalledTimes(1);
    });

    it("clamps a negative threshold to 0", () => {
      setup({ threshold: -1 });

      expect(live()[0].init.threshold).toBe(0);
    });

    it("re-observes when an option changes", () => {
      const { rerender } = setup({ threshold: 0.5 });
      const first = live()[0];

      rerender({ options: { threshold: 0.9 } });

      expect(first.disconnected).toBe(true);
      expect(live()).toHaveLength(1);
      expect(live()[0].init.threshold).toBe(0.9);
    });
  });

  describe("once", () => {
    it("reports a single impression and stops observing by default", () => {
      const { onImpression } = setup();
      const observer = live()[0];

      notify(observer, 1);
      advance(1000);

      expect(onImpression).toHaveBeenCalledTimes(1);
      expect(observer.disconnected).toBe(true);
      expect(live()).toHaveLength(0);
    });

    it("does not report again after being disabled and re-enabled", () => {
      const { rerender, onImpression } = setup({ once: true });
      notify(live()[0], 1);
      advance(1000);

      rerender({ options: { once: true, enabled: false } });
      rerender({ options: { once: true, enabled: true } });

      expect(live()).toHaveLength(0);
      expect(onImpression).toHaveBeenCalledTimes(1);
    });

    it("reports a new element even after the previous one was reported", () => {
      const { result, onImpression } = setup();
      notify(live()[0], 1);
      advance(1000);

      const next = document.createElement("div");
      act(() => result.current(next));
      expect(live()[0].observed).toEqual([next]);

      notify(live()[0], 1);
      advance(1000);
      expect(onImpression).toHaveBeenCalledTimes(2);
    });

    it("with once false, reports again after leaving and re-entering", () => {
      const { onImpression } = setup({ once: false });
      const observer = live()[0];

      notify(observer, 1);
      advance(1000);
      expect(onImpression).toHaveBeenCalledTimes(1);
      expect(observer.disconnected).toBe(false);

      notify(observer, 1);
      advance(5000);
      expect(onImpression).toHaveBeenCalledTimes(1);

      notify(observer, 0);
      notify(observer, 1);
      advance(1000);
      expect(onImpression).toHaveBeenCalledTimes(2);
    });
  });

  describe("enabled", () => {
    it("does not observe while disabled", () => {
      setup({ enabled: false });

      expect(MockIntersectionObserver.instances).toHaveLength(0);
    });

    it("disconnects and clears the timer when disabled", () => {
      const { rerender, onImpression } = setup();
      notify(live()[0], 1);
      advance(500);

      rerender({ options: { enabled: false } });
      expect(live()).toHaveLength(0);
      advance(5000);
      expect(onImpression).not.toHaveBeenCalled();
    });

    it("starts a fresh dwell timer when enabled again", () => {
      const { rerender, onImpression } = setup({ enabled: false });

      rerender({ options: { enabled: true } });
      notify(live()[0], 1);
      advance(999);
      expect(onImpression).not.toHaveBeenCalled();
      advance(1);
      expect(onImpression).toHaveBeenCalledTimes(1);
    });
  });

  describe("document visibility", () => {
    it("does not start the timer while the document is hidden", () => {
      const { onImpression } = setup();
      visibilityState = "hidden";

      notify(live()[0], 1);
      advance(5000);
      expect(onImpression).not.toHaveBeenCalled();

      setVisibility("visible");
      advance(999);
      expect(onImpression).not.toHaveBeenCalled();
      advance(1);
      expect(onImpression).toHaveBeenCalledTimes(1);
    });

    it("pauses while hidden and resumes with the remaining time", () => {
      const { onImpression } = setup({ minDurationMs: 1000 });

      notify(live()[0], 1);
      advance(400);
      setVisibility("hidden");
      advance(10_000);
      expect(onImpression).not.toHaveBeenCalled();

      setVisibility("visible");
      advance(599);
      expect(onImpression).not.toHaveBeenCalled();
      advance(1);
      expect(onImpression).toHaveBeenCalledTimes(1);
    });

    it("ignores visibility changes while the element is not visible", () => {
      const { onImpression } = setup();

      setVisibility("hidden");
      setVisibility("visible");
      advance(5000);

      expect(onImpression).not.toHaveBeenCalled();
    });

    it("does not restart a repeated impression on a visibility change", () => {
      const { onImpression } = setup({ once: false });
      notify(live()[0], 1);
      advance(1000);

      setVisibility("hidden");
      setVisibility("visible");
      advance(5000);

      expect(onImpression).toHaveBeenCalledTimes(1);
    });
  });

  describe("callback", () => {
    it("always calls the latest callback without re-observing", () => {
      const first = vi.fn();
      const second = vi.fn();
      const el = document.createElement("div");
      const { result, rerender } = renderHook(({ cb }) => useImpression(cb), {
        initialProps: { cb: first },
      });
      act(() => result.current(el));
      const observer = live()[0];

      notify(observer, 1);
      advance(500);
      rerender({ cb: second });
      expect(live()).toEqual([observer]);
      advance(500);

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });

    it("works with a real element rendered by React", () => {
      const onImpression = vi.fn();
      const Demo = () => {
        const ref = useImpression<HTMLDivElement>(onImpression);
        return createElement("div", { ref, "data-testid": "box" });
      };
      const { getByTestId } = render(createElement(Demo));

      expect(live()[0].observed).toEqual([getByTestId("box")]);
      notify(live()[0], 1);
      advance(1000);
      expect(onImpression).toHaveBeenCalledTimes(1);
    });
  });

  describe("cleanup", () => {
    it("disconnects and never calls back after unmount", () => {
      const { unmount, onImpression } = setup();
      const observer = live()[0];
      notify(observer, 1);
      advance(500);

      unmount();
      advance(5000);

      expect(observer.disconnected).toBe(true);
      expect(onImpression).not.toHaveBeenCalled();
    });

    it("removes the visibility listener on unmount", () => {
      const remove = vi.spyOn(document, "removeEventListener");
      const { unmount } = setup();

      unmount();

      expect(remove).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function)
      );
    });

    it("clears the timer and stops observing when the element is detached", () => {
      const { result, onImpression } = setup();
      notify(live()[0], 1);
      advance(500);

      act(() => result.current(null));
      expect(live()).toHaveLength(0);
      advance(5000);
      expect(onImpression).not.toHaveBeenCalled();
    });

    it("ignores an empty batch of entries", () => {
      const { onImpression } = setup();
      const observer = live()[0];

      act(() => {
        observer.callback([], observer as unknown as IntersectionObserver);
      });
      advance(5000);

      expect(onImpression).not.toHaveBeenCalled();
    });
  });

  describe("environment", () => {
    it("does nothing when IntersectionObserver is unavailable", () => {
      vi.stubGlobal("IntersectionObserver", undefined);
      const { onImpression } = setup();

      advance(5000);

      expect(MockIntersectionObserver.instances).toHaveLength(0);
      expect(onImpression).not.toHaveBeenCalled();
    });

    it("renders on the server without observing", () => {
      const Demo = () => {
        const ref = useImpression<HTMLDivElement>(vi.fn());
        return createElement("div", { ref }, "ad");
      };

      expect(renderToString(createElement(Demo))).toContain("ad");
      expect(MockIntersectionObserver.instances).toHaveLength(0);
    });
  });

  describe("StrictMode", () => {
    it("leaves a single live observer and reports once", () => {
      const onImpression = vi.fn();
      const Demo = () => {
        const ref = useImpression<HTMLDivElement>(onImpression);
        return createElement("div", { ref });
      };
      render(createElement(StrictMode, null, createElement(Demo)));

      expect(live()).toHaveLength(1);
      notify(live()[0], 1);
      advance(1000);
      expect(onImpression).toHaveBeenCalledTimes(1);
    });
  });
});
