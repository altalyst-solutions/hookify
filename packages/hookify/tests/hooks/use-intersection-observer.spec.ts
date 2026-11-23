import { act, render, renderHook } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIntersectionObserver } from "@/hooks";
import {
  createIntersectionObserverEntry,
  type FakeIntersectionObserver,
  installIntersectionObserver,
  type IntersectionObserverController,
  type IntersectionObserverEntryInit,
} from "@/testing";

let observers: IntersectionObserverController;

/** Delivers an entry for `el` to its observer, inside `act()`, and returns it. */
const trigger = (el: Element, overrides?: IntersectionObserverEntryInit) => {
  let entry!: IntersectionObserverEntry;
  act(() => {
    entry = observers.trigger(el, overrides);
  });
  return entry;
};

/** Delivers a batch of entries to one observer, inside `act()`. */
const notify = (
  observer: FakeIntersectionObserver,
  entries: IntersectionObserverEntry[]
) =>
  act(() => {
    observer.notify(entries);
  });

describe("useIntersectionObserver", () => {
  beforeEach(() => {
    observers = installIntersectionObserver();
  });

  afterEach(() => {
    observers.restore();
  });

  it("returns defaults and does not observe until an element is attached", () => {
    const { result, rerender } = renderHook(() => useIntersectionObserver());
    const ref = result.current.ref;

    expect(result.current.isIntersecting).toBe(false);
    expect(result.current.entry).toBeUndefined();
    expect(observers.instances).toHaveLength(0);

    rerender();
    expect(result.current.ref).toBe(ref);
  });

  it("observes the attached element and tracks intersection", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useIntersectionObserver());

    act(() => result.current.ref(el));
    expect(observers.active).toHaveLength(1);
    expect(observers.active[0].targets).toEqual([el]);

    const visible = trigger(el);
    expect(result.current.isIntersecting).toBe(true);
    expect(result.current.entry).toBe(visible);

    trigger(el, { isIntersecting: false });
    expect(result.current.isIntersecting).toBe(false);
  });

  it("uses the most recent entry of a batch for state", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useIntersectionObserver());
    act(() => result.current.ref(el));

    notify(observers.active[0], [
      createIntersectionObserverEntry(el, { isIntersecting: true }),
      createIntersectionObserverEntry(el, { isIntersecting: false }),
    ]);
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

    trigger(getByTestId("box"));
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

      expect(observers.active[0].options).toEqual({
        root,
        rootMargin: "10px",
        threshold: [0.5],
      });
    });

    it("uses the browser defaults when no options are given", () => {
      const el = document.createElement("div");
      const { result } = renderHook(() => useIntersectionObserver());
      act(() => result.current.ref(el));

      expect(observers.active[0].options).toEqual({
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
      const observer = observers.active[0];

      rerender({ threshold: [0, 0.5, 1] });
      expect(observers.active).toEqual([observer]);

      rerender({ threshold: [0, 1] });
      expect(observer.disconnected).toBe(true);
      expect(observers.active[0].options.threshold).toEqual([0, 1]);
    });

    it("re-observes when rootMargin changes", () => {
      const el = document.createElement("div");
      const { result, rerender } = renderHook(
        ({ rootMargin }) => useIntersectionObserver({ rootMargin }),
        { initialProps: { rootMargin: "0px" } }
      );
      act(() => result.current.ref(el));
      const first = observers.active[0];

      rerender({ rootMargin: "50px" });
      expect(first.disconnected).toBe(true);
      expect(observers.active[0].options.rootMargin).toBe("50px");
    });

    it("reports defaultIsIntersecting until the first notification", () => {
      const el = document.createElement("div");
      const { result } = renderHook(() =>
        useIntersectionObserver({ defaultIsIntersecting: true })
      );
      expect(result.current.isIntersecting).toBe(true);

      act(() => result.current.ref(el));
      expect(result.current.isIntersecting).toBe(true);

      trigger(el, { isIntersecting: false });
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
      const observer = observers.active[0];

      rerender({ onChange: second });
      expect(observers.active).toEqual([observer]);

      const a = createIntersectionObserverEntry(el, { intersectionRatio: 0.4 });
      const b = createIntersectionObserverEntry(el, { intersectionRatio: 0.9 });
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
      const observer = observers.active[0];

      trigger(el, { isIntersecting: false });
      expect(observer.disconnected).toBe(false);

      trigger(el, { isIntersecting: true });
      expect(result.current.isIntersecting).toBe(true);
      expect(observer.disconnected).toBe(true);
      expect(observers.active).toHaveLength(0);
    });

    it("observes again for a new element", () => {
      const a = document.createElement("div");
      const b = document.createElement("div");
      const { result } = renderHook(() =>
        useIntersectionObserver({ once: true })
      );
      act(() => result.current.ref(a));
      trigger(a, { isIntersecting: true });

      act(() => result.current.ref(b));
      expect(result.current.isIntersecting).toBe(false);
      expect(observers.active).toHaveLength(1);
      expect(observers.active[0].targets).toEqual([b]);
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
      expect(observers.instances).toHaveLength(0);

      rerender({ enabled: true });
      expect(observers.active).toHaveLength(1);
      trigger(el, { isIntersecting: true });

      rerender({ enabled: false });
      expect(observers.active).toHaveLength(0);
      expect(result.current.isIntersecting).toBe(true);

      rerender({ enabled: true });
      expect(observers.active).toHaveLength(1);
    });
  });

  describe("cleanup", () => {
    it("disconnects the observer on unmount", () => {
      const el = document.createElement("div");
      const { result, unmount } = renderHook(() => useIntersectionObserver());
      act(() => result.current.ref(el));
      const observer = observers.active[0];

      unmount();
      expect(observer.disconnected).toBe(true);
    });

    it("disconnects and resets to defaults when the element is detached", () => {
      const el = document.createElement("div");
      const { result } = renderHook(() => useIntersectionObserver());
      act(() => result.current.ref(el));
      trigger(el, { isIntersecting: true });

      act(() => result.current.ref(null));
      expect(observers.active).toHaveLength(0);
      expect(result.current.isIntersecting).toBe(false);
      expect(result.current.entry).toBeUndefined();
    });

    it("moves the observer to a new element and ignores the old entry", () => {
      const a = document.createElement("div");
      const b = document.createElement("div");
      const { result } = renderHook(() => useIntersectionObserver());
      act(() => result.current.ref(a));
      trigger(a, { isIntersecting: true });

      act(() => result.current.ref(b));
      expect(observers.active).toHaveLength(1);
      expect(observers.active[0].targets).toEqual([b]);
      expect(result.current.isIntersecting).toBe(false);
    });
  });

  describe("environment", () => {
    it("does nothing when IntersectionObserver is unavailable", () => {
      observers.restore();
      const el = document.createElement("div");
      const { result } = renderHook(() => useIntersectionObserver());

      expect(() => act(() => result.current.ref(el))).not.toThrow();
      expect(result.current.isIntersecting).toBe(false);
      expect(observers.instances).toHaveLength(0);
    });

    it("renders on the server with the default value", () => {
      const Demo = () => {
        const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>(
          { defaultIsIntersecting: true }
        );
        return createElement("div", { ref }, isIntersecting ? "in" : "out");
      };

      expect(renderToString(createElement(Demo))).toContain("in");
      expect(observers.instances).toHaveLength(0);
    });
  });

  describe("StrictMode", () => {
    it("leaves a single live observer", () => {
      const Demo = () => {
        const { ref } = useIntersectionObserver<HTMLDivElement>();
        return createElement("div", { ref });
      };
      render(createElement(StrictMode, null, createElement(Demo)));

      expect(observers.active).toHaveLength(1);
    });
  });
});
