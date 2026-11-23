import { afterEach, describe, expect, it, vi } from "vitest";

import { createResizeObserverEntry, installResizeObserver } from "@/testing";

describe("installResizeObserver", () => {
  const controllers: { restore: () => void }[] = [];

  /** Installs the fake and restores it after the test. */
  const install = () => {
    const controller = installResizeObserver();
    controllers.push(controller);
    return controller;
  };

  afterEach(() => {
    controllers
      .splice(0)
      .reverse()
      .forEach((controller) => controller.restore());
  });

  describe("installing and restoring", () => {
    it("replaces the global, and removes it again when there was none", () => {
      expect("ResizeObserver" in globalThis).toBe(false);

      const controller = install();
      expect("ResizeObserver" in globalThis).toBe(true);

      controller.restore();
      expect("ResizeObserver" in globalThis).toBe(false);
    });

    it("puts back the global that was there before", () => {
      const original = class {};
      Object.defineProperty(globalThis, "ResizeObserver", {
        configurable: true,
        writable: true,
        value: original,
      });

      const controller = install();
      expect(globalThis.ResizeObserver).not.toBe(original);

      controller.restore();
      expect(globalThis.ResizeObserver).toBe(original);

      delete (globalThis as Record<string, unknown>).ResizeObserver;
    });
  });

  describe("the fake observer", () => {
    it("records the callback, and starts with nothing observed", () => {
      const { instances } = install();
      const callback = vi.fn();

      new ResizeObserver(callback);

      expect(instances).toHaveLength(1);
      expect(instances[0].callback).toBe(callback);
      expect(instances[0].observations).toEqual([]);
      expect(instances[0].targets).toEqual([]);
      expect(instances[0].disconnected).toBe(false);
    });

    it("records what is observed, with the options it got", () => {
      const { instances } = install();
      const a = document.createElement("div");
      const b = document.createElement("div");
      const observer = new ResizeObserver(() => {});

      observer.observe(a);
      observer.observe(b, { box: "border-box" });

      expect(instances[0].observations).toEqual([
        { target: a, options: {} },
        { target: b, options: { box: "border-box" } },
      ]);
      expect(instances[0].targets).toEqual([a, b]);
    });

    it("replaces the options when an element is observed again", () => {
      const { instances } = install();
      const a = document.createElement("div");
      const b = document.createElement("div");
      const observer = new ResizeObserver(() => {});
      observer.observe(a, { box: "content-box" });
      observer.observe(b);

      observer.observe(a, { box: "border-box" });

      expect(instances[0].observations).toEqual([
        { target: b, options: {} },
        { target: a, options: { box: "border-box" } },
      ]);
    });

    it("stops observing an element on unobserve", () => {
      const { instances } = install();
      const a = document.createElement("div");
      const b = document.createElement("div");
      const observer = new ResizeObserver(() => {});
      observer.observe(a);
      observer.observe(b);

      observer.unobserve(a);

      expect(instances[0].targets).toEqual([b]);
    });

    it("stops observing everything on disconnect, and is active again after observe", () => {
      const { instances, active } = install();
      const el = document.createElement("div");
      const observer = new ResizeObserver(() => {});
      observer.observe(el);

      observer.disconnect();
      expect(instances[0].disconnected).toBe(true);
      expect(instances[0].targets).toEqual([]);
      expect(active).toEqual([]);

      observer.observe(el);
      expect(instances[0].disconnected).toBe(false);
      expect(instances[0].targets).toEqual([el]);
    });

    it("notifies with the entries and itself as the observer", () => {
      const { instances } = install();
      const callback = vi.fn();
      const el = document.createElement("div");
      new ResizeObserver(callback).observe(el);
      const entries = [createResizeObserverEntry(el, { width: 10 })];

      instances[0].notify(entries);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(entries, instances[0]);
    });

    it("doesn't notify after it was disconnected", () => {
      const { instances } = install();
      const callback = vi.fn();
      new ResizeObserver(callback).disconnect();

      instances[0].notify([createResizeObserverEntry(document.body)]);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("active", () => {
    it("lists the observers that haven't been disconnected", () => {
      const controller = install();
      const first = new ResizeObserver(() => {});
      new ResizeObserver(() => {});

      first.disconnect();

      expect(controller.instances).toHaveLength(2);
      expect(controller.active).toEqual([controller.instances[1]]);
    });
  });

  describe("trigger", () => {
    it("reports the size it is given", () => {
      const { trigger } = install();
      const callback = vi.fn();
      const el = document.createElement("div");
      new ResizeObserver(callback).observe(el);

      const entry = trigger(el, { width: 320, height: 200 });

      expect(entry.target).toBe(el);
      expect(entry.contentRect.width).toBe(320);
      expect(entry.contentRect.height).toBe(200);
      expect(callback).toHaveBeenCalledWith([entry], expect.anything());
    });

    it("reports an empty box when no size is given", () => {
      const { trigger } = install();
      const el = document.createElement("div");
      new ResizeObserver(() => {}).observe(el);

      const entry = trigger(el);

      expect(entry.contentRect.width).toBe(0);
      expect(entry.contentRect.height).toBe(0);
    });

    it("notifies every active observer of the element, and only those", () => {
      const { trigger } = install();
      const el = document.createElement("div");
      const other = document.createElement("div");
      const first = vi.fn();
      const second = vi.fn();
      const unrelated = vi.fn();
      const disconnected = vi.fn();
      new ResizeObserver(first).observe(el);
      new ResizeObserver(second).observe(el);
      new ResizeObserver(unrelated).observe(other);
      const gone = new ResizeObserver(disconnected);
      gone.observe(el);
      gone.disconnect();

      const entry = trigger(el, { width: 5 });

      expect(first).toHaveBeenCalledWith([entry], expect.anything());
      expect(second).toHaveBeenCalledWith([entry], expect.anything());
      expect(unrelated).not.toHaveBeenCalled();
      expect(disconnected).not.toHaveBeenCalled();
    });

    it("throws when no active observer observes the element", () => {
      const { trigger } = install();
      const el = document.createElement("div");

      expect(() => trigger(el)).toThrow(/No active ResizeObserver/);

      const observer = new ResizeObserver(() => {});
      observer.observe(el);
      observer.disconnect();
      expect(() => trigger(el)).toThrow(/No active ResizeObserver/);
    });
  });
});

describe("createResizeObserverEntry", () => {
  const el = document.createElement("div");

  it("describes the content box from the width and height", () => {
    const entry = createResizeObserverEntry(el, { width: 120, height: 45.5 });

    expect(entry.target).toBe(el);
    expect(entry.contentRect).toMatchObject({
      x: 0,
      y: 0,
      width: 120,
      height: 45.5,
      right: 120,
      bottom: 45.5,
    });
    expect(entry.contentRect.toJSON()).toBe(entry.contentRect);
    expect(entry.contentBoxSize).toEqual([
      { inlineSize: 120, blockSize: 45.5 },
    ]);
    expect(entry.devicePixelContentBoxSize).toEqual([]);
  });

  it("defaults to an empty box", () => {
    const entry = createResizeObserverEntry(el);

    expect(entry.contentRect.width).toBe(0);
    expect(entry.contentBoxSize).toEqual([{ inlineSize: 0, blockSize: 0 }]);
  });

  it("uses the content box as the border box unless given one", () => {
    expect(
      createResizeObserverEntry(el, { width: 10, height: 20 }).borderBoxSize
    ).toEqual([{ inlineSize: 10, blockSize: 20 }]);

    expect(
      createResizeObserverEntry(el, {
        width: 10,
        height: 20,
        borderBox: { inlineSize: 14, blockSize: 24 },
      }).borderBoxSize
    ).toEqual([{ inlineSize: 14, blockSize: 24 }]);
  });

  it("leaves the border box out when it is null, like older browsers", () => {
    expect(
      createResizeObserverEntry(el, { width: 10, borderBox: null })
        .borderBoxSize
    ).toBeUndefined();
  });
});
