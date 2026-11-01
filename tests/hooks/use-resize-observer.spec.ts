import { act, render, renderHook } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useResizeObserver } from "@/hooks";

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  observed: Element[] = [];
  observeOptions: ResizeObserverOptions[] = [];
  disconnected = false;

  constructor(readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }

  observe(target: Element, options?: ResizeObserverOptions) {
    this.observed.push(target);
    this.observeOptions.push(options ?? {});
  }

  unobserve() {}

  disconnect() {
    this.disconnected = true;
  }
}

const live = () => MockResizeObserver.instances.filter((o) => !o.disconnected);

const makeEntry = (target: Element, width = 100): ResizeObserverEntry =>
  ({
    target,
    contentRect: { width, height: 50 },
  }) as unknown as ResizeObserverEntry;

const notify = (observer: MockResizeObserver, entries: ResizeObserverEntry[]) =>
  act(() => {
    observer.callback(entries, observer as unknown as ResizeObserver);
  });

describe("useResizeObserver", () => {
  beforeEach(() => {
    MockResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a stable callback ref and does not observe until attached", () => {
    const { result, rerender } = renderHook(() => useResizeObserver(() => {}));
    const first = result.current;

    expect(typeof first).toBe("function");
    expect(MockResizeObserver.instances).toHaveLength(0);

    rerender();
    expect(result.current).toBe(first);
  });

  it("observes the attached element and passes the raw entry and observer", () => {
    const el = document.createElement("div");
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useResizeObserver<HTMLDivElement>(callback)
    );

    act(() => result.current(el));
    expect(live()).toHaveLength(1);
    expect(live()[0].observed).toEqual([el]);

    const entry = makeEntry(el, 240);
    notify(live()[0], [entry]);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(entry, live()[0]);
  });

  it("does not re-render the component on resize", () => {
    const el = document.createElement("div");
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useResizeObserver(() => {});
    });
    act(() => result.current(el));
    const before = renders;

    notify(live()[0], [makeEntry(el)]);
    expect(renders).toBe(before);
  });

  it("works with a real element rendered by React", () => {
    const seen: number[] = [];
    const Demo = () => {
      const ref = useResizeObserver<HTMLDivElement>((entry) =>
        seen.push(entry.contentRect.width)
      );
      return createElement("div", { ref, "data-testid": "box" });
    };
    const { getByTestId } = render(createElement(Demo));

    expect(live()[0].observed).toEqual([getByTestId("box")]);
    notify(live()[0], [makeEntry(getByTestId("box"), 300)]);
    expect(seen).toEqual([300]);
  });

  it("calls the callback once per delivered entry", () => {
    const el = document.createElement("div");
    const callback = vi.fn();
    const { result } = renderHook(() => useResizeObserver(callback));
    act(() => result.current(el));

    notify(live()[0], [makeEntry(el, 1), makeEntry(el, 2)]);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("always calls the latest callback without re-observing", () => {
    const el = document.createElement("div");
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useResizeObserver(cb), {
      initialProps: { cb: first },
    });
    act(() => result.current(el));
    const observer = live()[0];

    rerender({ cb: second });
    expect(live()).toEqual([observer]);

    notify(observer, [makeEntry(el)]);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  describe("box", () => {
    it("observes the content box by default", () => {
      const el = document.createElement("div");
      const { result } = renderHook(() => useResizeObserver(() => {}));
      act(() => result.current(el));

      expect(live()[0].observeOptions).toEqual([{ box: "content-box" }]);
    });

    it("passes a custom box and re-observes when it changes", () => {
      const el = document.createElement("div");
      const { result, rerender } = renderHook(
        ({ box }) => useResizeObserver(() => {}, { box }),
        {
          initialProps: {
            box: "border-box" as ResizeObserverBoxOptions,
          },
        }
      );
      act(() => result.current(el));
      const first = live()[0];
      expect(first.observeOptions).toEqual([{ box: "border-box" }]);

      rerender({ box: "device-pixel-content-box" });
      expect(first.disconnected).toBe(true);
      expect(live()).toHaveLength(1);
      expect(live()[0].observeOptions).toEqual([
        { box: "device-pixel-content-box" },
      ]);
    });
  });

  describe("enabled", () => {
    it("does not observe while disabled and resumes when enabled", () => {
      const el = document.createElement("div");
      const { result, rerender } = renderHook(
        ({ enabled }) => useResizeObserver(() => {}, { enabled }),
        { initialProps: { enabled: false } }
      );
      act(() => result.current(el));
      expect(MockResizeObserver.instances).toHaveLength(0);

      rerender({ enabled: true });
      expect(live()).toHaveLength(1);
      expect(live()[0].observed).toEqual([el]);

      rerender({ enabled: false });
      expect(live()).toHaveLength(0);
    });
  });

  describe("cleanup", () => {
    it("disconnects the observer on unmount", () => {
      const el = document.createElement("div");
      const { result, unmount } = renderHook(() => useResizeObserver(() => {}));
      act(() => result.current(el));
      const observer = live()[0];

      unmount();
      expect(observer.disconnected).toBe(true);
    });

    it("disconnects when the element is detached", () => {
      const el = document.createElement("div");
      const { result } = renderHook(() => useResizeObserver(() => {}));
      act(() => result.current(el));
      act(() => result.current(null));

      expect(live()).toHaveLength(0);
    });

    it("moves the observer to a new element", () => {
      const a = document.createElement("div");
      const b = document.createElement("div");
      const { result } = renderHook(() => useResizeObserver(() => {}));
      act(() => result.current(a));
      act(() => result.current(b));

      expect(live()).toHaveLength(1);
      expect(live()[0].observed).toEqual([b]);
    });
  });

  describe("environment", () => {
    it("does nothing when ResizeObserver is unavailable", () => {
      vi.stubGlobal("ResizeObserver", undefined);
      const el = document.createElement("div");
      const { result } = renderHook(() => useResizeObserver(() => {}));

      expect(() => act(() => result.current(el))).not.toThrow();
      expect(MockResizeObserver.instances).toHaveLength(0);
    });

    it("renders on the server without observing", () => {
      const Demo = () => {
        const ref = useResizeObserver<HTMLDivElement>(() => {});
        return createElement("div", { ref }, "ok");
      };

      expect(renderToString(createElement(Demo))).toContain("ok");
      expect(MockResizeObserver.instances).toHaveLength(0);
    });
  });

  describe("StrictMode", () => {
    it("leaves a single live observer", () => {
      const Demo = () => {
        const ref = useResizeObserver<HTMLDivElement>(() => {});
        return createElement("div", { ref });
      };
      render(createElement(StrictMode, null, createElement(Demo)));

      expect(live()).toHaveLength(1);
    });
  });
});
