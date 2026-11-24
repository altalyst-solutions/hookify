import { afterEach, describe, expect, it } from "vitest";

import { installClipboard } from "@/testing";

describe("installClipboard", () => {
  const controllers: { restore: () => void }[] = [];

  /** Installs the fake and restores it after the test. */
  const install = (options?: Parameters<typeof installClipboard>[0]) => {
    const controller = installClipboard(options);
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
    it("adds navigator.clipboard, and removes it again when there was none", () => {
      expect("clipboard" in navigator).toBe(false);

      const clipboard = install();
      expect(typeof navigator.clipboard.writeText).toBe("function");

      clipboard.restore();
      expect("clipboard" in navigator).toBe(false);
    });

    it("puts back a clipboard that was there before", () => {
      const original = { writeText: async () => {} };
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: original,
      });

      const clipboard = install();
      expect(navigator.clipboard).not.toBe(original);

      clipboard.restore();
      expect(navigator.clipboard).toBe(original);

      delete (navigator as { clipboard?: unknown }).clipboard;
    });

    it("does nothing when restore is called twice", () => {
      const first = install();
      first.restore();
      const second = install();

      first.restore();

      expect("clipboard" in navigator).toBe(true);
      second.restore();
      expect("clipboard" in navigator).toBe(false);
    });
  });

  describe("reading and writing", () => {
    it("starts empty, or with the text it is given", async () => {
      expect(install().text).toBe("");
      expect(await navigator.clipboard.readText()).toBe("");

      const other = install({ text: "hello" });
      expect(other.text).toBe("hello");
      expect(await navigator.clipboard.readText()).toBe("hello");
    });

    it("keeps what is written, and records every write", async () => {
      const clipboard = install();

      await navigator.clipboard.writeText("one");
      await navigator.clipboard.writeText("two");

      expect(clipboard.text).toBe("two");
      expect(clipboard.writes).toEqual(["one", "two"]);
      expect(await navigator.clipboard.readText()).toBe("two");
    });

    it("resolves a write with undefined", async () => {
      install();

      expect(await navigator.clipboard.writeText("x")).toBeUndefined();
    });

    it("counts reads", async () => {
      const clipboard = install();

      await navigator.clipboard.readText();
      await navigator.clipboard.readText();

      expect(clipboard.reads).toBe(2);
    });
  });

  describe("permission", () => {
    it("rejects reads and writes with a NotAllowedError while denied", async () => {
      const clipboard = install({ text: "kept" });
      clipboard.setPermission("denied");

      await expect(navigator.clipboard.writeText("x")).rejects.toMatchObject({
        name: "NotAllowedError",
      });
      await expect(navigator.clipboard.readText()).rejects.toMatchObject({
        name: "NotAllowedError",
      });
      expect(clipboard.text).toBe("kept");
      expect(clipboard.writes).toEqual([]);
      expect(clipboard.reads).toBe(1);
    });

    it("works again when it is granted", async () => {
      const clipboard = install();
      clipboard.setPermission("denied");
      clipboard.setPermission("granted");

      await navigator.clipboard.writeText("x");

      expect(clipboard.text).toBe("x");
    });
  });

  describe("failNext", () => {
    it("rejects the next call with what it is given, then works again", async () => {
      const clipboard = install();
      const error = new Error("boom");
      clipboard.failNext(error);

      await expect(navigator.clipboard.writeText("a")).rejects.toBe(error);
      expect(clipboard.writes).toEqual([]);

      await navigator.clipboard.writeText("b");
      expect(clipboard.writes).toEqual(["b"]);
    });

    it("can reject with a value that isn't an Error", async () => {
      install().failNext("nope");

      await expect(navigator.clipboard.writeText("a")).rejects.toBe("nope");
    });

    it("rejects with a plain Error by default", async () => {
      install().failNext();

      await expect(navigator.clipboard.writeText("a")).rejects.toBeInstanceOf(
        Error
      );
    });

    it("covers one call each, in order, and reads as well as writes", async () => {
      const clipboard = install();
      clipboard.failNext("first");
      clipboard.failNext("second");

      await expect(navigator.clipboard.readText()).rejects.toBe("first");
      await expect(navigator.clipboard.writeText("a")).rejects.toBe("second");
      await expect(navigator.clipboard.writeText("b")).resolves.toBeUndefined();
    });

    it("takes priority over a denied permission", async () => {
      const clipboard = install();
      clipboard.setPermission("denied");
      clipboard.failNext("custom");

      await expect(navigator.clipboard.writeText("a")).rejects.toBe("custom");
    });
  });

  describe("deferNext", () => {
    it("holds a write until it is resolved", async () => {
      const clipboard = install();
      clipboard.deferNext();

      let done = false;
      const promise = navigator.clipboard.writeText("slow").then(() => {
        done = true;
      });
      await Promise.resolve();

      expect(done).toBe(false);
      expect(clipboard.text).toBe("");
      expect(clipboard.pending).toHaveLength(1);
      expect(clipboard.pending[0].type).toBe("write");
      expect(clipboard.pending[0].text).toBe("slow");
      expect(clipboard.pending[0].settled).toBe(false);

      clipboard.pending[0].resolve();
      await promise;

      expect(done).toBe(true);
      expect(clipboard.text).toBe("slow");
      expect(clipboard.writes).toEqual(["slow"]);
      expect(clipboard.pending[0].settled).toBe(true);
    });

    it("holds a read, and resolves it with the text at that moment", async () => {
      const clipboard = install({ text: "before" });
      clipboard.deferNext();

      const promise = navigator.clipboard.readText();
      await navigator.clipboard.writeText("after");
      expect(clipboard.pending[0].type).toBe("read");

      clipboard.pending[0].resolve();

      expect(await promise).toBe("after");
    });

    it("rejects a held call with what it is given", async () => {
      const clipboard = install();
      clipboard.deferNext();
      const promise = navigator.clipboard.writeText("x");

      clipboard.pending[0].reject("late failure");

      await expect(promise).rejects.toBe("late failure");
      expect(clipboard.writes).toEqual([]);
    });

    it("rejects a held call with a NotAllowedError by default", async () => {
      const clipboard = install();
      clipboard.deferNext();
      const promise = navigator.clipboard.writeText("x");

      clipboard.pending[0].reject();

      await expect(promise).rejects.toMatchObject({ name: "NotAllowedError" });
    });

    it("ignores settling a call twice", async () => {
      const clipboard = install();
      clipboard.deferNext();
      const promise = navigator.clipboard.writeText("x");

      clipboard.pending[0].resolve();
      clipboard.pending[0].reject("too late");
      clipboard.pending[0].resolve();
      await promise;

      expect(clipboard.writes).toEqual(["x"]);
    });

    it("can be mixed with failNext, in order", async () => {
      const clipboard = install();
      clipboard.deferNext();
      clipboard.failNext(new Error("second failed"));

      const first = navigator.clipboard.writeText("a");
      await expect(navigator.clipboard.writeText("b")).rejects.toThrow(
        "second failed"
      );
      clipboard.pending[0].resolve();
      await first;

      expect(clipboard.writes).toEqual(["a"]);
    });

    it("rejects calls that are still held with an AbortError on restore", async () => {
      const clipboard = install();
      clipboard.deferNext();
      const promise = navigator.clipboard.writeText("x");

      clipboard.restore();

      await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    });
  });

  describe("without a navigator", () => {
    it("throws a clear error", () => {
      const navigatorDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        "navigator"
      );
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: undefined,
      });

      try {
        expect(() => installClipboard()).toThrow(/needs a navigator/);
      } finally {
        if (navigatorDescriptor) {
          Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
        }
      }
    });
  });
});
