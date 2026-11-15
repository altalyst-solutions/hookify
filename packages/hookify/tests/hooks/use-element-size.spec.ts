import { act, render, renderHook } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useElementSize } from "@/hooks";

interface Box {
  inlineSize: number;
  blockSize: number;
}

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

const makeEntry = (
  target: Element,
  size: { width: number; height: number },
  borderBox?: Box
): ResizeObserverEntry =>
  ({
    target,
    contentRect: { width: size.width, height: size.height },
    contentBoxSize: [{ inlineSize: size.width, blockSize: size.height }],
    borderBoxSize: borderBox ? [borderBox] : undefined,
    devicePixelContentBoxSize: [],
  }) as unknown as ResizeObserverEntry;

const notify = (
  observer: MockResizeObserver,
  entries: ResizeObserverEntry[]
) => {
  act(() => {
    observer.callback(entries, observer as unknown as ResizeObserver);
  });
};

const resize = (
  size: { width: number; height: number },
  borderBox?: Box,
  observer = live()[0]
) => notify(observer, [makeEntry(observer.observed[0], size, borderBox)]);

describe("useElementSize", () => {
  beforeEach(() => {
    MockResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts at 0 x 0 and does not observe until a ref is attached", () => {
    const { result } = renderHook(() => useElementSize());

    expect(result.current.width).toBe(0);
    expect(result.current.height).toBe(0);
    expect(typeof result.current.ref).toBe("function");
    expect(MockResizeObserver.instances).toHaveLength(0);
  });

  it("measures the element attached through the ref", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useElementSize<HTMLDivElement>());

    act(() => result.current.ref(el));
    expect(live()).toHaveLength(1);
    expect(live()[0].observed).toEqual([el]);

    resize({ width: 120, height: 45.5 });
    expect(result.current.width).toBe(120);
    expect(result.current.height).toBe(45.5);
  });

  it("works with a real element rendered by React", () => {
    const Demo = () => {
      const { ref, width, height } = useElementSize<HTMLDivElement>();
      return createElement(
        "div",
        { ref, "data-testid": "box" },
        `${width}x${height}`
      );
    };
    const { getByTestId } = render(createElement(Demo));
    const box = getByTestId("box");

    expect(box.textContent).toBe("0x0");
    expect(live()[0].observed).toEqual([box]);

    resize({ width: 300, height: 200 });
    expect(box.textContent).toBe("300x200");
  });

  it("uses the last entry when several are delivered at once", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useElementSize());
    act(() => result.current.ref(el));

    notify(live()[0], [
      makeEntry(el, { width: 10, height: 10 }),
      makeEntry(el, { width: 20, height: 30 }),
    ]);
    expect(result.current.width).toBe(20);
    expect(result.current.height).toBe(30);
  });

  it("ignores empty notifications", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() => useElementSize());
    act(() => result.current.ref(el));

    notify(live()[0], []);
    expect(result.current.width).toBe(0);
  });

  it("returns defaultSize until the first measurement", () => {
    const el = document.createElement("div");
    const { result } = renderHook(() =>
      useElementSize({ defaultSize: { width: 800, height: 600 } })
    );

    expect(result.current.width).toBe(800);
    expect(result.current.height).toBe(600);

    act(() => result.current.ref(el));
    resize({ width: 50, height: 60 });
    expect(result.current.width).toBe(50);
    expect(result.current.height).toBe(60);
  });

  it("does not re-render when the size is unchanged", () => {
    const el = document.createElement("div");
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useElementSize();
    });
    act(() => result.current.ref(el));

    resize({ width: 10, height: 20 });
    const afterFirst = renders;

    resize({ width: 10, height: 20 });
    expect(renders).toBe(afterFirst);

    resize({ width: 10, height: 21 });
    expect(renders).toBe(afterFirst + 1);
  });

  it("keeps a stable ref across renders", () => {
    const { result, rerender } = renderHook(() => useElementSize());
    const first = result.current.ref;

    rerender();
    expect(result.current.ref).toBe(first);
  });

  describe("box", () => {
    it("observes the content box by default and reads contentRect", () => {
      const el = document.createElement("div");
      const { result } = renderHook(() => useElementSize());
      act(() => result.current.ref(el));

      expect(live()[0].observeOptions).toEqual([{ box: "content-box" }]);

      resize({ width: 100, height: 50 }, { inlineSize: 140, blockSize: 90 });
      expect(result.current.width).toBe(100);
      expect(result.current.height).toBe(50);
    });

    it("reads the border box when box is border-box", () => {
      const el = document.createElement("div");
      const { result } = renderHook(() =>
        useElementSize({ box: "border-box" })
      );
      act(() => result.current.ref(el));

      expect(live()[0].observeOptions).toEqual([{ box: "border-box" }]);

      resize({ width: 100, height: 50 }, { inlineSize: 140, blockSize: 90 });
      expect(result.current.width).toBe(140);
      expect(result.current.height).toBe(90);
    });

    it("swaps the border box axes in vertical writing modes", () => {
      const el = document.createElement("div");
      el.style.writingMode = "vertical-rl";
      const { result } = renderHook(() =>
        useElementSize({ box: "border-box" })
      );
      act(() => result.current.ref(el));

      resize({ width: 100, height: 50 }, { inlineSize: 90, blockSize: 140 });
      expect(result.current.width).toBe(140);
      expect(result.current.height).toBe(90);
    });

    it("falls back to getBoundingClientRect when borderBoxSize is missing", () => {
      const el = document.createElement("div");
      el.getBoundingClientRect = () =>
        ({ width: 77, height: 33 }) as unknown as DOMRect;
      const { result } = renderHook(() =>
        useElementSize({ box: "border-box" })
      );
      act(() => result.current.ref(el));

      resize({ width: 1, height: 1 });
      expect(result.current.width).toBe(77);
      expect(result.current.height).toBe(33);
    });

    it("re-observes when box changes", () => {
      const el = document.createElement("div");
      const { result, rerender } = renderHook(
        ({ box }: { box: "content-box" | "border-box" }) =>
          useElementSize({ box }),
        { initialProps: { box: "content-box" as "content-box" | "border-box" } }
      );
      act(() => result.current.ref(el));
      const first = live()[0];

      rerender({ box: "border-box" });

      expect(first.disconnected).toBe(true);
      expect(live()).toHaveLength(1);
      expect(live()[0].observeOptions).toEqual([{ box: "border-box" }]);
    });
  });

  describe("onResize", () => {
    it("is called with the size and entry, including the first measurement", () => {
      const el = document.createElement("div");
      const onResize = vi.fn();
      const { result } = renderHook(() => useElementSize({ onResize }));
      act(() => result.current.ref(el));

      expect(onResize).not.toHaveBeenCalled();

      const entry = makeEntry(el, { width: 10, height: 20 });
      notify(live()[0], [entry]);
      expect(onResize).toHaveBeenCalledTimes(1);
      expect(onResize).toHaveBeenLastCalledWith(
        { width: 10, height: 20 },
        entry
      );

      resize({ width: 30, height: 20 });
      expect(onResize).toHaveBeenCalledTimes(2);
      expect(onResize.mock.calls[1][0]).toEqual({ width: 30, height: 20 });
    });

    it("is not called when the size did not change", () => {
      const el = document.createElement("div");
      const onResize = vi.fn();
      const { result } = renderHook(() => useElementSize({ onResize }));
      act(() => result.current.ref(el));

      resize({ width: 10, height: 20 });
      resize({ width: 10, height: 20 });
      expect(onResize).toHaveBeenCalledTimes(1);
    });

    it("always calls the latest callback without re-observing", () => {
      const el = document.createElement("div");
      const first = vi.fn();
      const second = vi.fn();
      const { result, rerender } = renderHook(
        ({ cb }: { cb: () => void }) => useElementSize({ onResize: cb }),
        { initialProps: { cb: first } }
      );
      act(() => result.current.ref(el));
      const observer = live()[0];

      rerender({ cb: second });
      expect(live()).toEqual([observer]);

      resize({ width: 5, height: 5 });
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });
  });

  describe("element lifecycle", () => {
    it("disconnects the observer on unmount", () => {
      const el = document.createElement("div");
      const { result, unmount } = renderHook(() => useElementSize());
      act(() => result.current.ref(el));
      const observer = live()[0];

      unmount();
      expect(observer.disconnected).toBe(true);
    });

    it("disconnects but keeps the last size when the element is detached", () => {
      const el = document.createElement("div");
      const { result } = renderHook(() => useElementSize());
      act(() => result.current.ref(el));
      resize({ width: 40, height: 60 });
      const observer = live()[0];

      act(() => result.current.ref(null));
      expect(observer.disconnected).toBe(true);
      expect(live()).toHaveLength(0);
      expect(result.current.width).toBe(40);
      expect(result.current.height).toBe(60);
    });

    it("moves the observer to a new element", () => {
      const a = document.createElement("div");
      const b = document.createElement("div");
      const { result } = renderHook(() => useElementSize());

      act(() => result.current.ref(a));
      const first = live()[0];
      resize({ width: 10, height: 10 });

      act(() => result.current.ref(b));
      expect(first.disconnected).toBe(true);
      expect(live()).toHaveLength(1);
      expect(live()[0].observed).toEqual([b]);

      resize({ width: 99, height: 88 });
      expect(result.current.width).toBe(99);
      expect(result.current.height).toBe(88);
    });
  });

  describe("environment", () => {
    it("returns the default size when ResizeObserver is unavailable", () => {
      vi.stubGlobal("ResizeObserver", undefined);
      const el = document.createElement("div");
      const { result } = renderHook(() =>
        useElementSize({ defaultSize: { width: 5, height: 6 } })
      );

      expect(() => act(() => result.current.ref(el))).not.toThrow();
      expect(result.current.width).toBe(5);
      expect(result.current.height).toBe(6);
    });

    it("renders the default size on the server", () => {
      const Demo = () => {
        const { ref, width, height } = useElementSize<HTMLDivElement>({
          defaultSize: { width: 320, height: 240 },
        });
        return createElement("div", { ref }, `${width}x${height}`);
      };

      expect(renderToString(createElement(Demo))).toContain("320x240");
      expect(MockResizeObserver.instances).toHaveLength(0);
    });
  });

  describe("StrictMode", () => {
    it("measures once and leaves a single live observer", () => {
      const el = document.createElement("div");
      const onResize = vi.fn();
      const { result, unmount } = renderHook(
        () => useElementSize<HTMLDivElement>({ onResize }),
        { wrapper: StrictMode }
      );
      act(() => result.current.ref(el));

      expect(live()).toHaveLength(1);

      for (const observer of live()) {
        notify(observer, [makeEntry(el, { width: 12, height: 34 })]);
      }
      expect(result.current.width).toBe(12);
      expect(result.current.height).toBe(34);
      expect(onResize).toHaveBeenCalledTimes(1);

      unmount();
      expect(live()).toHaveLength(0);
    });
  });
});
