import { act, render, renderHook } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIntersectionObserver } from "@/hooks";

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
  isIntersecting: boolean,
  intersectionRatio = isIntersecting ? 1 : 0
): IntersectionObserverEntry =>
  ({
    target,
    isIntersecting,
    intersectionRatio,
  }) as unknown as IntersectionObserverEntry;

const notify = (
  observer: MockIntersectionObserver,
  entries: IntersectionObserverEntry[]
) =>
  act(() => {
    observer.callback(entries, observer as unknown as IntersectionObserver);
  });

describe("useIntersectionObserver", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns defaults and does not observe until an element is attached", () => {
    const { result, rerender } = renderHook(() => useIntersectionObserver());
    const ref = result.current.ref;

    expect(result.current.isIntersecting).toBe(false);
    expect(result.current.entry).toBeUndefined();
    expect(MockIntersectionObserver.instances).toHaveLength(0);

    rerender();
    expect(result.current.ref).toBe(ref);
  });

  it("observes the attached element and tracks intersection", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useIntersectionObserver());

    act(() => result.current.ref(el));
    expect(live()).toHaveLength(1);
    expect(live()[0].observed).toEqual([el]);

    const visible = makeEntry(el, true);
    notify(live()[0], [visible]);
    expect(result.current.isIntersecting).toBe(true);
    expect(result.current.entry).toBe(visible);

    notify(live()[0], [makeEntry(el, false)]);
    expect(result.current.isIntersecting).toBe(false);
  });

  it("uses the most recent entry of a batch for state", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useIntersectionObserver());
    act(() => result.current.ref(el));

    notify(live()[0], [makeEntry(el, true), makeEntry(el, false)]);
    expect(result.current.isIntersecting).toBe(false);
  });

  it("works with a real element rendered by React", () => {
    const Demo = () => {
      const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>();
      return createElement(
        "div",
        { ref, "data-testid": "box" },
        isIntersecting ? "in" : "out"
      );
    };
    const { getByTestId } = render(createElement(Demo));
    expect(getByTestId("box").textContent).toBe("out");

    notify(live()[0], [makeEntry(getByTestId("box"), true)]);
    expect(getByTestId("box").textContent).toBe("in");
  });

  describe("options", () => {
    it("passes root, rootMargin and threshold to the observer", () => {
      const el = document.createElement("div");
      const root = document.createElement("section");
      const { result } = renderHook(() =>
        useIntersectionObserver({ root, rootMargin: "10px", threshold: 0.5 })
      );
      act(() => result.current.ref(el));

      expect(live()[0].init).toEqual({
        root,
        rootMargin: "10px",
        threshold: [0.5],
      });
    });

    it("uses the browser defaults when no options are given", () => {
      const el = document.createElement("div");
      const { result } = renderHook(() => useIntersectionObserver());
      act(() => result.current.ref(el));

      expect(live()[0].init).toEqual({
        root: null,
        rootMargin: "0px",
        threshold: [0],
      });
    });

    it("does not re-observe for an equal inline threshold array", () => {
      const el = document.createElement("div");
      const { result, rerender } = renderHook(
        ({ threshold }) => useIntersectionObserver({ threshold }),
        { initialProps: { threshold: [0, 0.5, 1] } }
      );
      act(() => result.current.ref(el));
      const observer = live()[0];

      rerender({ threshold: [0, 0.5, 1] });
      expect(live()).toEqual([observer]);

      rerender({ threshold: [0, 1] });
      expect(observer.disconnected).toBe(true);
      expect(live()[0].init.threshold).toEqual([0, 1]);
    });

    it("re-observes when rootMargin changes", () => {
      const el = document.createElement("div");
      const { result, rerender } = renderHook(
        ({ rootMargin }) => useIntersectionObserver({ rootMargin }),
        { initialProps: { rootMargin: "0px" } }
      );
      act(() => result.current.ref(el));
      const first = live()[0];

      rerender({ rootMargin: "50px" });
      expect(first.disconnected).toBe(true);
      expect(live()[0].init.rootMargin).toBe("50px");
    });

    it("reports defaultIsIntersecting until the first notification", () => {
      const el = document.createElement("div");
      const { result } = renderHook(() =>
        useIntersectionObserver({ defaultIsIntersecting: true })
      );
      expect(result.current.isIntersecting).toBe(true);

      act(() => result.current.ref(el));
      expect(result.current.isIntersecting).toBe(true);

      notify(live()[0], [makeEntry(el, false)]);
      expect(result.current.isIntersecting).toBe(false);
    });
  });

  describe("onChange", () => {
    it("is called with every raw entry, and always uses the latest callback", () => {
      const el = document.createElement("div");
      const first = vi.fn();
      const second = vi.fn();
      const { result, rerender } = renderHook(
        ({ onChange }) => useIntersectionObserver({ onChange }),
        { initialProps: { onChange: first } }
      );
      act(() => result.current.ref(el));
      const observer = live()[0];

      rerender({ onChange: second });
      expect(live()).toEqual([observer]);

      const a = makeEntry(el, true, 0.4);
      const b = makeEntry(el, true, 0.9);
      notify(observer, [a, b]);

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(2);
      expect(second).toHaveBeenNthCalledWith(1, a);
      expect(second).toHaveBeenNthCalledWith(2, b);
    });
  });

  describe("once", () => {
    it("stops observing after the first intersection and stays true", () => {
      const el = document.createElement("div");
      const { result } = renderHook(() =>
        useIntersectionObserver({ once: true })
      );
      act(() => result.current.ref(el));
      const observer = live()[0];

      notify(observer, [makeEntry(el, false)]);
      expect(observer.disconnected).toBe(false);

      notify(observer, [makeEntry(el, true)]);
      expect(result.current.isIntersecting).toBe(true);
      expect(observer.disconnected).toBe(true);
      expect(live()).toHaveLength(0);
    });

    it("observes again for a new element", () => {
      const a = document.createElement("div");
      const b = document.createElement("div");
      const { result } = renderHook(() =>
        useIntersectionObserver({ once: true })
      );
      act(() => result.current.ref(a));
      notify(live()[0], [makeEntry(a, true)]);

      act(() => result.current.ref(b));
      expect(result.current.isIntersecting).toBe(false);
      expect(live()).toHaveLength(1);
      expect(live()[0].observed).toEqual([b]);
    });
  });

  describe("enabled", () => {
    it("does not observe while disabled, keeps the last value, and resumes", () => {
      const el = document.createElement("div");
      const { result, rerender } = renderHook(
        ({ enabled }) => useIntersectionObserver({ enabled }),
        { initialProps: { enabled: false } }
      );
      act(() => result.current.ref(el));
      expect(MockIntersectionObserver.instances).toHaveLength(0);

      rerender({ enabled: true });
      expect(live()).toHaveLength(1);
      notify(live()[0], [makeEntry(el, true)]);

      rerender({ enabled: false });
      expect(live()).toHaveLength(0);
      expect(result.current.isIntersecting).toBe(true);

      rerender({ enabled: true });
      expect(live()).toHaveLength(1);
    });
  });

  describe("cleanup", () => {
    it("disconnects the observer on unmount", () => {
      const el = document.createElement("div");
      const { result, unmount } = renderHook(() => useIntersectionObserver());
      act(() => result.current.ref(el));
      const observer = live()[0];

      unmount();
      expect(observer.disconnected).toBe(true);
    });

    it("disconnects and resets to defaults when the element is detached", () => {
      const el = document.createElement("div");
      const { result } = renderHook(() => useIntersectionObserver());
      act(() => result.current.ref(el));
      notify(live()[0], [makeEntry(el, true)]);

      act(() => result.current.ref(null));
      expect(live()).toHaveLength(0);
      expect(result.current.isIntersecting).toBe(false);
      expect(result.current.entry).toBeUndefined();
    });

    it("moves the observer to a new element and ignores the old entry", () => {
      const a = document.createElement("div");
      const b = document.createElement("div");
      const { result } = renderHook(() => useIntersectionObserver());
      act(() => result.current.ref(a));
      notify(live()[0], [makeEntry(a, true)]);

      act(() => result.current.ref(b));
      expect(live()).toHaveLength(1);
      expect(live()[0].observed).toEqual([b]);
      expect(result.current.isIntersecting).toBe(false);
    });
  });

  describe("environment", () => {
    it("does nothing when IntersectionObserver is unavailable", () => {
      vi.stubGlobal("IntersectionObserver", undefined);
      const el = document.createElement("div");
      const { result } = renderHook(() => useIntersectionObserver());

      expect(() => act(() => result.current.ref(el))).not.toThrow();
      expect(result.current.isIntersecting).toBe(false);
      expect(MockIntersectionObserver.instances).toHaveLength(0);
    });

    it("renders on the server with the default value", () => {
      const Demo = () => {
        const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>(
          { defaultIsIntersecting: true }
        );
        return createElement("div", { ref }, isIntersecting ? "in" : "out");
      };

      expect(renderToString(createElement(Demo))).toContain("in");
      expect(MockIntersectionObserver.instances).toHaveLength(0);
    });
  });

  describe("StrictMode", () => {
    it("leaves a single live observer", () => {
      const Demo = () => {
        const { ref } = useIntersectionObserver<HTMLDivElement>();
        return createElement("div", { ref });
      };
      render(createElement(StrictMode, null, createElement(Demo)));

      expect(live()).toHaveLength(1);
    });
  });
});
