import { afterEach, describe, expect, it, vi } from "vitest";

import { type FakeMediaQueryList, installMatchMedia } from "@/testing";

/** Calls the installed fake `matchMedia`, typed as the fake list. */
const media = (query: string) =>
  window.matchMedia(query) as unknown as FakeMediaQueryList;

describe("installMatchMedia", () => {
  const controllers: { restore: () => void }[] = [];

  /** Installs the fake and restores it after the test. */
  const install = (options?: Parameters<typeof installMatchMedia>[0]) => {
    const controller = installMatchMedia(options);
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
    it("replaces the global, and leaves it unavailable again after restore", () => {
      expect(typeof window.matchMedia).toBe("undefined");

      const controller = install();
      expect(typeof window.matchMedia).toBe("function");

      controller.restore();
      expect(typeof window.matchMedia).toBe("undefined");
    });

    it("puts back the global that was there before", () => {
      const saved = Object.getOwnPropertyDescriptor(globalThis, "matchMedia");
      const original = () => ({}) as MediaQueryList;
      Object.defineProperty(globalThis, "matchMedia", {
        configurable: true,
        writable: true,
        value: original,
      });

      const controller = install();
      expect(window.matchMedia).not.toBe(original);

      controller.restore();
      expect(window.matchMedia).toBe(original);

      if (saved) {
        Object.defineProperty(globalThis, "matchMedia", saved);
      } else {
        delete (globalThis as Record<string, unknown>).matchMedia;
      }
    });
  });

  describe("matches", () => {
    it("is false for every query by default", () => {
      const { getMatches } = install();

      expect(getMatches("(min-width: 600px)")).toBe(false);
      expect(media("(min-width: 600px)").matches).toBe(false);
    });

    it("uses the matches option for queries that were never set", () => {
      const { getMatches, setMatches } = install({ matches: true });

      expect(media("(a)").matches).toBe(true);

      setMatches("(a)", false);
      expect(getMatches("(a)")).toBe(false);
      expect(getMatches("(b)")).toBe(true);
    });

    it("keeps existing lists live when a query changes", () => {
      const { setMatches } = install();
      const list = media("(a)");

      setMatches("(a)", true);

      expect(list.matches).toBe(true);
      expect(media("(a)").matches).toBe(true);
      expect(media("(b)").matches).toBe(false);
    });

    it("matches queries as exact strings", () => {
      const { setMatches } = install();

      setMatches("(min-width: 600px)", true);

      expect(media("(min-width:600px)").matches).toBe(false);
    });
  });

  describe("the fake list", () => {
    it("creates a new list for every call, and records them", () => {
      const { instances } = install();

      const first = media("(a)");
      const second = media("(a)");

      expect(first).not.toBe(second);
      expect(first.media).toBe("(a)");
      expect(instances).toEqual([first, second]);
    });

    it("notifies change listeners with the new state", () => {
      const { setMatches } = install();
      const listener = vi.fn();
      const list = media("(a)");
      list.addEventListener("change", listener);

      setMatches("(a)", true);

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as MediaQueryListEvent;
      expect(event.type).toBe("change");
      expect(event.matches).toBe(true);
      expect(event.media).toBe("(a)");
    });

    it("calls listener objects through handleEvent", () => {
      const { setMatches } = install();
      const handleEvent = vi.fn();
      media("(a)").addEventListener("change", { handleEvent });

      setMatches("(a)", true);

      expect(handleEvent).toHaveBeenCalledTimes(1);
    });

    it("ignores other event types", () => {
      install();
      const listener = vi.fn();
      const list = media("(a)");
      list.addEventListener("resize", listener);

      list.dispatchEvent(new Event("resize"));
      list.dispatchEvent(new Event("change"));

      expect(listener).not.toHaveBeenCalled();
      expect(list.listenerCount).toBe(0);
    });

    it("adds a listener once, and removes it", () => {
      install();
      const listener = vi.fn();
      const list = media("(a)");

      list.addEventListener("change", listener);
      list.addEventListener("change", listener);
      expect(list.listenerCount).toBe(1);

      list.removeEventListener("change", listener);
      expect(list.listenerCount).toBe(0);

      list.removeEventListener("resize", listener);
    });

    it("ignores a null listener", () => {
      install();
      const list = media("(a)");

      list.addEventListener("change", null);

      expect(list.listenerCount).toBe(0);
    });

    it("removes a listener registered with once after it runs", () => {
      const { setMatches, listenerCount } = install();
      const listener = vi.fn();
      media("(a)").addEventListener("change", listener, {
        once: true,
      });

      setMatches("(a)", true);
      setMatches("(a)", false);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listenerCount()).toBe(0);
    });

    it("supports the deprecated addListener and removeListener", () => {
      const { setMatches, listenerCount } = install();
      const listener = vi.fn();
      const list = media("(a)");

      list.addListener(listener);
      expect(listenerCount("(a)")).toBe(1);

      setMatches("(a)", true);
      expect(listener).toHaveBeenCalledTimes(1);

      list.removeListener(listener);
      expect(listenerCount("(a)")).toBe(0);
      list.addListener(null);
      list.removeListener(null);
    });

    it("calls onchange after the listeners", () => {
      const { setMatches } = install();
      const order: string[] = [];
      const list = media("(a)");
      list.addEventListener("change", () => order.push("listener"));
      list.onchange = () => order.push("onchange");

      setMatches("(a)", true);

      expect(order).toEqual(["listener", "onchange"]);
    });
  });

  describe("setMatches", () => {
    it("notifies every list for the query, and only those", () => {
      const { setMatches } = install();
      const first = vi.fn();
      const second = vi.fn();
      const other = vi.fn();
      media("(a)").addEventListener("change", first);
      media("(a)").addEventListener("change", second);
      media("(b)").addEventListener("change", other);

      setMatches("(a)", true);

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
      expect(other).not.toHaveBeenCalled();
    });

    it("does nothing when the value doesn't change", () => {
      const { setMatches } = install();
      const listener = vi.fn();
      media("(a)").addEventListener("change", listener);

      setMatches("(a)", false);
      expect(listener).not.toHaveBeenCalled();

      setMatches("(a)", true);
      setMatches("(a)", true);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("sets a query that has no lists yet", () => {
      const { setMatches, getMatches } = install();

      setMatches("(a)", true);

      expect(getMatches("(a)")).toBe(true);
    });
  });

  describe("listenersAdded and listenersRemoved", () => {
    it("count registrations and removals across lists", () => {
      const controller = install();
      const noop = () => {};
      const first = media("(a)");
      const second = media("(b)");

      first.addEventListener("change", noop);
      first.addEventListener("change", noop);
      second.addEventListener("change", noop);
      expect(controller.listenersAdded).toBe(2);
      expect(controller.listenersRemoved).toBe(0);

      first.removeEventListener("change", noop);
      first.removeEventListener("change", noop);
      expect(controller.listenersRemoved).toBe(1);
      expect(controller.listenersAdded).toBe(2);
    });

    it("count a listener registered with once as removed after it runs", () => {
      const controller = install();
      media("(a)").addEventListener("change", () => {}, { once: true });

      controller.setMatches("(a)", true);

      expect(controller.listenersAdded).toBe(1);
      expect(controller.listenersRemoved).toBe(1);
    });
  });

  describe("listenerCount", () => {
    it("counts listeners across lists, optionally for one query", () => {
      const { listenerCount } = install();
      const noop = () => {};
      media("(a)").addEventListener("change", noop);
      media("(a)").addEventListener("change", noop);
      media("(b)").addEventListener("change", noop);

      expect(listenerCount()).toBe(3);
      expect(listenerCount("(a)")).toBe(2);
      expect(listenerCount("(b)")).toBe(1);
      expect(listenerCount("(c)")).toBe(0);
    });
  });
});
