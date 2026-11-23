import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createIntersectionObserverEntry,
  installIntersectionObserver,
} from "@/testing";

describe("installIntersectionObserver", () => {
  const controllers: { restore: () => void }[] = [];

  /** Installs the fake and restores it after the test. */
  const install = () => {
    const controller = installIntersectionObserver();
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
      expect("IntersectionObserver" in globalThis).toBe(false);

      const controller = install();
      expect("IntersectionObserver" in globalThis).toBe(true);

      controller.restore();
      expect("IntersectionObserver" in globalThis).toBe(false);
    });

    it("puts back the global that was there before", () => {
      const original = class {};
      Object.defineProperty(globalThis, "IntersectionObserver", {
        configurable: true,
        writable: true,
        value: original,
      });

      const controller = install();
      expect(globalThis.IntersectionObserver).not.toBe(original);

      controller.restore();
      expect(globalThis.IntersectionObserver).toBe(original);

      delete (globalThis as Record<string, unknown>).IntersectionObserver;
    });

    it("does nothing when restore is called twice", () => {
      const first = install();
      first.restore();
      const second = install();
      const fake = globalThis.IntersectionObserver;

      first.restore();
      expect(globalThis.IntersectionObserver).toBe(fake);

      second.restore();
      expect("IntersectionObserver" in globalThis).toBe(false);
    });

    it("keeps each installation's instances separate", () => {
      const first = install();
      new IntersectionObserver(() => {});
      first.restore();

      const second = install();
      expect(first.instances).toHaveLength(1);
      expect(second.instances).toHaveLength(0);
    });
  });

  describe("the fake observer", () => {
    it("records the callback and options, with the browser's defaults", () => {
      const { instances } = install();
      const callback = vi.fn();

      new IntersectionObserver(callback);
      const [observer] = instances;

      expect(observer.callback).toBe(callback);
      expect(observer.options).toEqual({});
      expect(observer.root).toBeNull();
      expect(observer.rootMargin).toBe("0px");
      expect(observer.thresholds).toEqual([0]);
      expect(observer.targets).toEqual([]);
      expect(observer.disconnected).toBe(false);
    });

    it("exposes the options it was created with", () => {
      const { instances } = install();
      const root = document.createElement("div");
      const options = { root, rootMargin: "10px", threshold: [0, 0.5, 1] };

      new IntersectionObserver(() => {}, options);

      expect(instances[0].options).toBe(options);
      expect(instances[0].root).toBe(root);
      expect(instances[0].rootMargin).toBe("10px");
      expect(instances[0].thresholds).toEqual([0, 0.5, 1]);
    });

    it("turns a single threshold into an array", () => {
      const { instances } = install();

      new IntersectionObserver(() => {}, { threshold: 0.25 });

      expect(instances[0].thresholds).toEqual([0.25]);
    });

    it("observes each element once, and stops on unobserve", () => {
      const { instances } = install();
      const a = document.createElement("div");
      const b = document.createElement("div");
      const observer = new IntersectionObserver(() => {});

      observer.observe(a);
      observer.observe(b);
      observer.observe(a);
      expect(instances[0].targets).toEqual([a, b]);

      observer.unobserve(a);
      expect(instances[0].targets).toEqual([b]);
    });

    it("stops observing everything on disconnect, and is active again after observe", () => {
      const { instances, active } = install();
      const el = document.createElement("div");
      const observer = new IntersectionObserver(() => {});
      observer.observe(el);

      observer.disconnect();
      expect(instances[0].disconnected).toBe(true);
      expect(instances[0].targets).toEqual([]);
      expect(active).toEqual([]);

      observer.observe(el);
      expect(instances[0].disconnected).toBe(false);
      expect(instances[0].targets).toEqual([el]);
    });

    it("never has queued records", () => {
      install();

      expect(new IntersectionObserver(() => {}).takeRecords()).toEqual([]);
    });

    it("notifies with the entries and itself as the observer", () => {
      const { instances } = install();
      const callback = vi.fn();
      const el = document.createElement("div");
      new IntersectionObserver(callback).observe(el);
      const entries = [createIntersectionObserverEntry(el)];

      instances[0].notify(entries);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(entries, instances[0]);
    });

    it("doesn't notify after it was disconnected", () => {
      const { instances } = install();
      const callback = vi.fn();
      const observer = new IntersectionObserver(callback);
      observer.disconnect();

      instances[0].notify([createIntersectionObserverEntry(document.body)]);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("active", () => {
    it("lists the observers that haven't been disconnected", () => {
      const controller = install();
      const first = new IntersectionObserver(() => {});
      new IntersectionObserver(() => {});

      first.disconnect();

      expect(controller.instances).toHaveLength(2);
      expect(controller.active).toEqual([controller.instances[1]]);
    });
  });

  describe("trigger", () => {
    it("reports the element as fully visible by default", () => {
      const { trigger } = install();
      const callback = vi.fn();
      const el = document.createElement("div");
      new IntersectionObserver(callback).observe(el);

      const entry = trigger(el);

      expect(entry.target).toBe(el);
      expect(entry.isIntersecting).toBe(true);
      expect(entry.intersectionRatio).toBe(1);
      expect(callback).toHaveBeenCalledWith([entry], expect.anything());
    });

    it("applies the overrides", () => {
      const { trigger } = install();
      const el = document.createElement("div");
      new IntersectionObserver(() => {}).observe(el);

      const entry = trigger(el, { isIntersecting: false });

      expect(entry.isIntersecting).toBe(false);
      expect(entry.intersectionRatio).toBe(0);
    });

    it("notifies every active observer of the element, and only those", () => {
      const { trigger } = install();
      const el = document.createElement("div");
      const other = document.createElement("div");
      const first = vi.fn();
      const second = vi.fn();
      const unrelated = vi.fn();
      const disconnected = vi.fn();
      new IntersectionObserver(first).observe(el);
      new IntersectionObserver(second).observe(el);
      new IntersectionObserver(unrelated).observe(other);
      const gone = new IntersectionObserver(disconnected);
      gone.observe(el);
      gone.disconnect();

      const entry = trigger(el);

      expect(first).toHaveBeenCalledWith([entry], expect.anything());
      expect(second).toHaveBeenCalledWith([entry], expect.anything());
      expect(unrelated).not.toHaveBeenCalled();
      expect(disconnected).not.toHaveBeenCalled();
    });

    it("throws when no active observer observes the element", () => {
      const { trigger } = install();
      const el = document.createElement("div");

      expect(() => trigger(el)).toThrow(/No active IntersectionObserver/);

      const observer = new IntersectionObserver(() => {});
      observer.observe(el);
      observer.disconnect();
      expect(() => trigger(el)).toThrow(/No active IntersectionObserver/);
    });
  });
});

describe("createIntersectionObserverEntry", () => {
  const el = document.createElement("div");

  it("describes a fully visible element by default", () => {
    const entry = createIntersectionObserverEntry(el);

    expect(entry.target).toBe(el);
    expect(entry.isIntersecting).toBe(true);
    expect(entry.intersectionRatio).toBe(1);
    expect(entry.rootBounds).toBeNull();
    expect(entry.time).toBe(0);
  });

  it("derives the ratio from isIntersecting", () => {
    expect(
      createIntersectionObserverEntry(el, { isIntersecting: true })
        .intersectionRatio
    ).toBe(1);
    expect(
      createIntersectionObserverEntry(el, { isIntersecting: false })
        .intersectionRatio
    ).toBe(0);
  });

  it("derives isIntersecting from the ratio", () => {
    expect(
      createIntersectionObserverEntry(el, { intersectionRatio: 0.4 })
        .isIntersecting
    ).toBe(true);
    expect(
      createIntersectionObserverEntry(el, { intersectionRatio: 0 })
        .isIntersecting
    ).toBe(false);
  });

  it("keeps both fields when they are given, even if they disagree", () => {
    const entry = createIntersectionObserverEntry(el, {
      isIntersecting: true,
      intersectionRatio: 0,
    });

    expect(entry.isIntersecting).toBe(true);
    expect(entry.intersectionRatio).toBe(0);
  });

  it("uses empty rectangles that can be serialized, unless overridden", () => {
    const entry = createIntersectionObserverEntry(el);

    expect(entry.boundingClientRect.width).toBe(0);
    expect(entry.intersectionRect.height).toBe(0);
    expect(entry.boundingClientRect.toJSON()).toBe(entry.boundingClientRect);

    const rect = { ...entry.boundingClientRect, width: 50 };
    expect(
      createIntersectionObserverEntry(el, { boundingClientRect: rect })
        .boundingClientRect
    ).toBe(rect);
  });

  it("applies the other overrides", () => {
    expect(createIntersectionObserverEntry(el, { time: 12 }).time).toBe(12);
  });
});
