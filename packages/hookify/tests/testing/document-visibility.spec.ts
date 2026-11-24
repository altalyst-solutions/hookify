import { afterEach, describe, expect, it, vi } from "vitest";

import { installDocumentVisibility } from "@/testing";

describe("installDocumentVisibility", () => {
  const controllers: { restore: () => void }[] = [];

  /** Installs the fake and restores it after the test. */
  const install = (
    options?: Parameters<typeof installDocumentVisibility>[0]
  ) => {
    const controller = installDocumentVisibility(options);
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
    it("starts visible by default", () => {
      const visibility = install();

      expect(document.visibilityState).toBe("visible");
      expect(document.hidden).toBe(false);
      expect(visibility.visibilityState).toBe("visible");
      expect(visibility.hidden).toBe(false);
    });

    it("starts in the state it is given", () => {
      const visibility = install({ visibilityState: "hidden" });

      expect(document.visibilityState).toBe("hidden");
      expect(document.hidden).toBe(true);
      expect(visibility.hidden).toBe(true);
    });

    it("gives the document its original properties back", () => {
      const addEventListener = document.addEventListener;
      const removeEventListener = document.removeEventListener;
      const own = (name: string) =>
        Object.getOwnPropertyDescriptor(document, name);
      expect(own("visibilityState")).toBeUndefined();

      const visibility = install({ visibilityState: "hidden" });
      expect(own("visibilityState")).toBeDefined();

      visibility.restore();
      expect(own("visibilityState")).toBeUndefined();
      expect(own("hidden")).toBeUndefined();
      expect(own("addEventListener")).toBeUndefined();
      expect(document.addEventListener).toBe(addEventListener);
      expect(document.removeEventListener).toBe(removeEventListener);
      expect(document.visibilityState).toBe("visible");
    });

    it("restores a property the document had of its own", () => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "prerender",
      });

      const visibility = install();
      expect(document.visibilityState).toBe("visible");

      visibility.restore();
      expect(document.visibilityState).toBe("prerender");

      delete (document as unknown as Record<string, unknown>).visibilityState;
    });

    it("does nothing when restore is called twice", () => {
      const first = install({ visibilityState: "hidden" });
      first.restore();
      const second = install({ visibilityState: "hidden" });

      first.restore();
      expect(document.visibilityState).toBe("hidden");

      second.restore();
      expect(document.visibilityState).toBe("visible");
    });

    it("throws when there is no document", () => {
      vi.stubGlobal("document", undefined);

      expect(() => installDocumentVisibility()).toThrow(/needs a document/);
    });
  });

  describe("setVisibility", () => {
    it("changes the state and fires visibilitychange", () => {
      const visibility = install();
      const listener = vi.fn();
      document.addEventListener("visibilitychange", listener);

      visibility.setVisibility("hidden");

      expect(document.visibilityState).toBe("hidden");
      expect(document.hidden).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].type).toBe("visibilitychange");

      visibility.setVisibility("visible");
      expect(document.hidden).toBe(false);
      expect(listener).toHaveBeenCalledTimes(2);

      document.removeEventListener("visibilitychange", listener);
    });

    it("reads the new state inside the listener", () => {
      const visibility = install();
      const seen: string[] = [];
      const listener = () => seen.push(document.visibilityState);
      document.addEventListener("visibilitychange", listener);

      visibility.setVisibility("hidden");

      expect(seen).toEqual(["hidden"]);
      document.removeEventListener("visibilitychange", listener);
    });

    it("does nothing when the state is the same", () => {
      const visibility = install();
      const listener = vi.fn();
      document.addEventListener("visibilitychange", listener);

      visibility.setVisibility("visible");

      expect(listener).not.toHaveBeenCalled();
      document.removeEventListener("visibilitychange", listener);
    });

    it("reports a state that isn't visible as hidden", () => {
      const visibility = install();

      visibility.setVisibility("prerender" as DocumentVisibilityState);

      expect(document.visibilityState).toBe("prerender");
      expect(document.hidden).toBe(true);
    });
  });

  describe("listenerCount", () => {
    it("counts the visibilitychange listeners added and removed", () => {
      const visibility = install();
      const a = () => {};
      const b = () => {};

      document.addEventListener("visibilitychange", a);
      document.addEventListener("visibilitychange", a);
      document.addEventListener("visibilitychange", b);
      expect(visibility.listenerCount).toBe(2);

      document.removeEventListener("visibilitychange", a);
      expect(visibility.listenerCount).toBe(1);

      document.removeEventListener("visibilitychange", b);
      expect(visibility.listenerCount).toBe(0);
    });

    it("counts how many listeners were added and removed overall", () => {
      const visibility = install();
      const a = () => {};

      document.addEventListener("visibilitychange", a);
      document.addEventListener("visibilitychange", a);
      expect(visibility.listenersAdded).toBe(1);
      expect(visibility.listenersRemoved).toBe(0);

      document.removeEventListener("visibilitychange", a);
      document.removeEventListener("visibilitychange", a);
      expect(visibility.listenersAdded).toBe(1);
      expect(visibility.listenersRemoved).toBe(1);

      document.addEventListener("visibilitychange", a);
      expect(visibility.listenersAdded).toBe(2);
      document.removeEventListener("visibilitychange", a);
    });

    it("ignores other events", () => {
      const visibility = install();
      const listener = () => {};

      document.addEventListener("click", listener);
      document.removeEventListener("click", listener);

      expect(visibility.listenerCount).toBe(0);
    });

    it("still delivers events to the listeners it counts", () => {
      const visibility = install();
      const listener = vi.fn();

      document.addEventListener("visibilitychange", listener, {
        capture: true,
      });
      visibility.setVisibility("hidden");
      document.removeEventListener("visibilitychange", listener, {
        capture: true,
      });
      visibility.setVisibility("visible");

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
