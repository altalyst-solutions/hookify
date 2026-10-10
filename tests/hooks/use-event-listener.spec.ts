import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { useEventListener } from "@/hooks";

describe("useEventListener", () => {
  it("listens on window by default", () => {
    const handler = vi.fn();
    renderHook(() => useEventListener("resize", handler));

    window.dispatchEvent(new Event("resize"));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("listens on document", () => {
    const handler = vi.fn();
    renderHook(() => useEventListener("keydown", handler, document));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].key).toBe("a");
  });

  it("listens on an element", () => {
    const el = document.createElement("button");
    const handler = vi.fn();
    renderHook(() => useEventListener("click", handler, el));

    el.click();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("listens on an element held by a ref", () => {
    const el = document.createElement("div");
    const ref = createRef<HTMLDivElement>() as { current: HTMLDivElement };
    ref.current = el;
    const handler = vi.fn();
    renderHook(() => useEventListener("click", handler, ref));

    el.click();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("supports custom events on any EventTarget", () => {
    const target = new EventTarget();
    const handler = vi.fn();
    renderHook(() =>
      useEventListener<CustomEvent<number>>("ping", handler, target)
    );

    target.dispatchEvent(new CustomEvent("ping", { detail: 7 }));

    expect(handler.mock.calls[0][0].detail).toBe(7);
  });

  it("attaches nothing for a null target or an empty ref", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const handler = vi.fn();
    renderHook(() => {
      useEventListener("click", handler, null);
      useEventListener("click", handler, { current: null });
    });

    expect(addSpy.mock.calls.filter(([type]) => type === "click")).toEqual([]);
    addSpy.mockRestore();
  });

  it("calls the latest handler without re-subscribing", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ handler }) => useEventListener("resize", handler),
      { initialProps: { handler: first } }
    );
    const subscriptions = addSpy.mock.calls.filter(
      ([type]) => type === "resize"
    ).length;

    rerender({ handler: second });
    window.dispatchEvent(new Event("resize"));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(
      addSpy.mock.calls.filter(([type]) => type === "resize")
    ).toHaveLength(subscriptions);
    addSpy.mockRestore();
  });

  it("removes the listener on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useEventListener("resize", handler));

    unmount();
    window.dispatchEvent(new Event("resize"));

    expect(handler).not.toHaveBeenCalled();
  });

  it("re-subscribes when the event type changes", () => {
    const handler = vi.fn();
    const { rerender } = renderHook(
      ({ type }: { type: "resize" | "scroll" }) =>
        useEventListener(type, handler),
      { initialProps: { type: "resize" } }
    );

    rerender({ type: "scroll" });
    window.dispatchEvent(new Event("resize"));
    expect(handler).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("scroll"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("re-subscribes when the target changes", () => {
    const a = document.createElement("div");
    const b = document.createElement("div");
    const handler = vi.fn();
    const { rerender } = renderHook(
      ({ el }) => useEventListener("click", handler, el),
      { initialProps: { el: a } }
    );

    rerender({ el: b });
    a.click();
    expect(handler).not.toHaveBeenCalled();

    b.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("forwards options and does not re-subscribe for equal inline options", () => {
    const el = document.createElement("div");
    const addSpy = vi.spyOn(el, "addEventListener");
    const handler = vi.fn();
    const { rerender } = renderHook(() =>
      useEventListener("click", handler, el, { once: true, passive: true })
    );

    rerender();

    expect(addSpy).toHaveBeenCalledTimes(1);
    el.click();
    el.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("works under StrictMode", () => {
    const handler = vi.fn();
    renderHook(() => useEventListener("resize", handler), {
      reactStrictMode: true,
    });

    window.dispatchEvent(new Event("resize"));

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
