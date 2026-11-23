import { act, render, renderHook } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useResizeObserver } from "@/hooks";
import {
  createResizeObserverEntry,
  type FakeResizeObserver,
  installResizeObserver,
  type ResizeObserverController,
  type ResizeObserverEntryInit,
} from "@/testing";

let observers: ResizeObserverController;

/** Delivers an entry for `el` to its observer, inside `act()`, and returns it. */
const trigger = (el: Element, size?: ResizeObserverEntryInit) => {
  let entry!: ResizeObserverEntry;
  act(() => {
    entry = observers.trigger(el, size);
  });
  return entry;
};

/** Delivers a batch of entries to one observer, inside `act()`. */
const notify = (observer: FakeResizeObserver, entries: ResizeObserverEntry[]) =>
  act(() => {
    observer.notify(entries);
  });

describe("useResizeObserver", () => {
  beforeEach(() => {
    observers = installResizeObserver();
  });

  afterEach(() => {
    observers.restore();
  });

  it("returns a stable callback ref and does not observe until attached", () => {
    const { result, rerender } = renderHook(() => useResizeObserver(() => {}));
    const first = result.current;

    expect(typeof first).toBe("function");
    expect(observers.instances).toHaveLength(0);

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
    expect(observers.active).toHaveLength(1);
    expect(observers.active[0].targets).toEqual([el]);

    const entry = trigger(el, { width: 240 });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(entry, observers.active[0]);
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

    trigger(el);
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

    expect(observers.active[0].targets).toEqual([getByTestId("box")]);
    trigger(getByTestId("box"), { width: 300 });
    expect(seen).toEqual([300]);
  });

  it("calls the callback once per delivered entry", () => {
    const el = document.createElement("div");
    const callback = vi.fn();
    const { result } = renderHook(() => useResizeObserver(callback));
    act(() => result.current(el));

    notify(observers.active[0], [
      createResizeObserverEntry(el, { width: 1 }),
      createResizeObserverEntry(el, { width: 2 }),
    ]);
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
    const observer = observers.active[0];

    rerender({ cb: second });
    expect(observers.active).toEqual([observer]);

    trigger(el);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  describe("box", () => {
    it("observes the content box by default", () => {
      const el = document.createElement("div");
      const { result } = renderHook(() => useResizeObserver(() => {}));
      act(() => result.current(el));

      expect(observers.active[0].observations).toEqual([
        { target: el, options: { box: "content-box" } },
      ]);
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
      const first = observers.active[0];
      expect(first.observations).toEqual([
        { target: el, options: { box: "border-box" } },
      ]);

      rerender({ box: "device-pixel-content-box" });
      expect(first.disconnected).toBe(true);
      expect(observers.active).toHaveLength(1);
      expect(observers.active[0].observations).toEqual([
        { target: el, options: { box: "device-pixel-content-box" } },
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
      expect(observers.instances).toHaveLength(0);

      rerender({ enabled: true });
      expect(observers.active).toHaveLength(1);
      expect(observers.active[0].targets).toEqual([el]);

      rerender({ enabled: false });
      expect(observers.active).toHaveLength(0);
    });
  });

  describe("cleanup", () => {
    it("disconnects the observer on unmount", () => {
      const el = document.createElement("div");
      const { result, unmount } = renderHook(() => useResizeObserver(() => {}));
      act(() => result.current(el));
      const observer = observers.active[0];

      unmount();
      expect(observer.disconnected).toBe(true);
    });

    it("disconnects when the element is detached", () => {
      const el = document.createElement("div");
      const { result } = renderHook(() => useResizeObserver(() => {}));
      act(() => result.current(el));
      act(() => result.current(null));

      expect(observers.active).toHaveLength(0);
    });

    it("moves the observer to a new element", () => {
      const a = document.createElement("div");
      const b = document.createElement("div");
      const { result } = renderHook(() => useResizeObserver(() => {}));
      act(() => result.current(a));
      act(() => result.current(b));

      expect(observers.active).toHaveLength(1);
      expect(observers.active[0].targets).toEqual([b]);
    });
  });

  describe("environment", () => {
    it("does nothing when ResizeObserver is unavailable", () => {
      observers.restore();
      const el = document.createElement("div");
      const { result } = renderHook(() => useResizeObserver(() => {}));

      expect(() => act(() => result.current(el))).not.toThrow();
      expect(observers.instances).toHaveLength(0);
    });

    it("renders on the server without observing", () => {
      const Demo = () => {
        const ref = useResizeObserver<HTMLDivElement>(() => {});
        return createElement("div", { ref }, "ok");
      };

      expect(renderToString(createElement(Demo))).toContain("ok");
      expect(observers.instances).toHaveLength(0);
    });
  });

  describe("StrictMode", () => {
    it("leaves a single live observer", () => {
      const Demo = () => {
        const ref = useResizeObserver<HTMLDivElement>(() => {});
        return createElement("div", { ref });
      };
      render(createElement(StrictMode, null, createElement(Demo)));

      expect(observers.active).toHaveLength(1);
    });
  });
});
