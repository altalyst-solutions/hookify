import { afterEach, describe, expect, it, vi } from "vitest";

import { installWebLocks } from "@/testing";

/** Waits for the microtasks that grants and settlements run in. */
const flush = async () => {
  for (let index = 0; index < 5; index++) await Promise.resolve();
};

/** A promise that is settled from the outside, to keep a lock held. */
const gate = () => {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
};

describe("installWebLocks", () => {
  const controllers: { restore: () => void }[] = [];

  /** Installs the fake and restores it after the test. */
  const install = () => {
    const controller = installWebLocks();
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
    it("adds navigator.locks, and removes it again when there was none", () => {
      expect("locks" in navigator).toBe(false);

      const locks = install();
      expect(typeof navigator.locks.request).toBe("function");

      locks.restore();
      expect("locks" in navigator).toBe(false);
    });

    it("puts back a lock manager that was there before", () => {
      const original = { request: async () => {} };
      Object.defineProperty(navigator, "locks", {
        configurable: true,
        value: original,
      });

      const locks = install();
      expect(navigator.locks).not.toBe(original);

      locks.restore();
      expect(navigator.locks).toBe(original);

      delete (navigator as { locks?: unknown }).locks;
    });

    it("does nothing when restore is called twice", () => {
      const first = install();
      first.restore();
      const second = install();

      first.restore();

      expect("locks" in navigator).toBe(true);
      second.restore();
      expect("locks" in navigator).toBe(false);
    });

    it("throws a clear error when there is no navigator", () => {
      const descriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        "navigator"
      );
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: undefined,
      });

      try {
        expect(() => installWebLocks()).toThrow(/needs a navigator/);
      } finally {
        if (descriptor) {
          Object.defineProperty(globalThis, "navigator", descriptor);
        }
      }
    });

    it("drops held and waiting locks on restore", async () => {
      const locks = install();
      const callback = vi.fn();
      locks.hold("a");
      void navigator.locks.request("a", callback);
      await flush();

      locks.restore();

      expect(callback).not.toHaveBeenCalled();
      expect(locks.held).toEqual([]);
      expect(locks.pending).toEqual([]);
    });
  });

  describe("request", () => {
    it("runs the callback asynchronously with the lock, and resolves with its result", async () => {
      install();
      const callback = vi.fn(async (lock: Lock | null) => lock?.name);

      const promise = navigator.locks.request("a", callback);
      expect(callback).not.toHaveBeenCalled();

      expect(await promise).toBe("a");
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0]).toMatchObject({
        name: "a",
        mode: "exclusive",
      });
    });

    it("accepts a request without options", async () => {
      const locks = install();

      await navigator.locks.request("a", async () => {});

      expect(locks.requests).toEqual([{ name: "a", options: {} }]);
    });

    it("rejects with what the callback throws, and releases the lock", async () => {
      const locks = install();

      await expect(
        navigator.locks.request("a", async () => {
          throw new Error("boom");
        })
      ).rejects.toThrow("boom");
      await flush();

      expect(locks.held).toEqual([]);
    });

    it("holds the lock until the callback's promise settles", async () => {
      const locks = install();
      const hold = gate();
      const promise = navigator.locks.request("a", () => hold.promise);
      await flush();

      expect(locks.held).toEqual([{ name: "a", mode: "exclusive" }]);

      hold.open();
      await promise;
      await flush();

      expect(locks.held).toEqual([]);
    });

    it("records every call with the options that were passed", async () => {
      const locks = install();
      const options = { mode: "shared" as const, ifAvailable: true };

      await navigator.locks.request("a", options, async () => {});

      expect(locks.requests).toHaveLength(1);
      expect(locks.requests[0].name).toBe("a");
      expect(locks.requests[0].options).toBe(options);
    });
  });

  describe("queueing", () => {
    it("grants requests for the same name in the order they were made", async () => {
      install();
      const order: string[] = [];
      const first = gate();

      const a = navigator.locks.request("n", async () => {
        order.push("a");
        await first.promise;
      });
      const b = navigator.locks.request("n", async () => {
        order.push("b");
      });
      const c = navigator.locks.request("n", async () => {
        order.push("c");
      });
      await flush();
      expect(order).toEqual(["a"]);

      first.open();
      await Promise.all([a, b, c]);

      expect(order).toEqual(["a", "b", "c"]);
    });

    it("lets different names run at the same time", async () => {
      const locks = install();
      const hold = gate();
      void navigator.locks.request("a", () => hold.promise);
      void navigator.locks.request("b", () => hold.promise);
      await flush();

      expect(locks.held.map((lock) => lock.name)).toEqual(["a", "b"]);

      hold.open();
    });

    it("runs shared requests together", async () => {
      const locks = install();
      const hold = gate();
      void navigator.locks.request("n", { mode: "shared" }, () => hold.promise);
      void navigator.locks.request("n", { mode: "shared" }, () => hold.promise);
      await flush();

      expect(locks.held).toHaveLength(2);
      expect(locks.pending).toHaveLength(0);

      hold.open();
    });

    it("makes an exclusive request wait for shared holders", async () => {
      const locks = install();
      const hold = gate();
      const exclusive = vi.fn(async () => {});
      void navigator.locks.request("n", { mode: "shared" }, () => hold.promise);
      void navigator.locks.request("n", exclusive);
      await flush();

      expect(exclusive).not.toHaveBeenCalled();
      expect(locks.pending).toEqual([{ name: "n", mode: "exclusive" }]);

      hold.open();
      await flush();
      expect(exclusive).toHaveBeenCalledTimes(1);
    });

    it("makes a shared request wait behind an earlier waiting exclusive one", async () => {
      install();
      const order: string[] = [];
      const hold = gate();
      void navigator.locks.request("n", { mode: "shared" }, async () => {
        order.push("shared 1");
        await hold.promise;
      });
      void navigator.locks.request("n", async () => {
        order.push("exclusive");
      });
      void navigator.locks.request("n", { mode: "shared" }, async () => {
        order.push("shared 2");
      });
      await flush();
      expect(order).toEqual(["shared 1"]);

      hold.open();
      await flush();
      await flush();

      expect(order).toEqual(["shared 1", "exclusive", "shared 2"]);
    });

    it("grants a run of shared requests together once the exclusive one is done", async () => {
      const locks = install();
      const exclusive = gate();
      void navigator.locks.request("n", () => exclusive.promise);
      const hold = gate();
      void navigator.locks.request("n", { mode: "shared" }, () => hold.promise);
      void navigator.locks.request("n", { mode: "shared" }, () => hold.promise);
      await flush();
      expect(locks.held).toHaveLength(1);

      exclusive.open();
      await flush();

      expect(locks.held).toHaveLength(2);
      hold.open();
    });
  });

  describe("ifAvailable", () => {
    it("runs the callback with null when the lock is taken", async () => {
      const locks = install();
      locks.hold("n");
      const callback = vi.fn(async (lock: Lock | null) => lock);

      const result = await navigator.locks.request(
        "n",
        { ifAvailable: true },
        callback
      );

      expect(callback).toHaveBeenCalledWith(null);
      expect(result).toBeNull();
      expect(locks.pending).toEqual([]);
    });

    it("runs the callback with the lock when it is free", async () => {
      install();

      const name = await navigator.locks.request(
        "n",
        { ifAvailable: true },
        async (lock) => lock?.name
      );

      expect(name).toBe("n");
    });

    it("runs with null when earlier requests are still waiting", async () => {
      const locks = install();
      locks.hold("n");
      void navigator.locks.request("n", async () => {});
      await flush();

      const result = await navigator.locks.request(
        "n",
        { ifAvailable: true },
        async (lock) => lock
      );

      expect(result).toBeNull();
    });
  });

  describe("steal", () => {
    it("takes the lock first, and rejects the holder with an AbortError", async () => {
      const locks = install();
      const hold = gate();
      const holder = navigator.locks.request("n", () => hold.promise);
      await flush();
      const stolen = vi.fn(async (lock: Lock | null) => lock?.name);

      const thief = navigator.locks.request("n", { steal: true }, stolen);

      await expect(holder).rejects.toMatchObject({ name: "AbortError" });
      expect(await thief).toBe("n");
      expect(locks.held).toEqual([]);
      hold.open();
    });

    it("goes ahead of requests that are waiting", async () => {
      install();
      const order: string[] = [];
      const hold = gate();
      void navigator.locks
        .request("n", () => hold.promise)
        .catch(() => order.push("holder aborted"));
      void navigator.locks.request("n", async () => {
        order.push("waiting");
      });
      await flush();

      await navigator.locks.request("n", { steal: true }, async () => {
        order.push("thief");
      });
      await flush();

      expect(order).toEqual(["holder aborted", "thief", "waiting"]);
      hold.open();
    });

    it("steals from a lock taken with hold", async () => {
      const locks = install();
      locks.hold("n");
      await flush();
      expect(locks.held).toHaveLength(1);

      const name = await navigator.locks.request(
        "n",
        { steal: true },
        async (lock) => lock?.name
      );

      expect(name).toBe("n");
    });
  });

  describe("signal", () => {
    it("rejects a waiting request with the signal's reason, and removes it", async () => {
      const locks = install();
      locks.hold("n");
      const controller = new AbortController();
      const callback = vi.fn();
      const promise = navigator.locks.request(
        "n",
        { signal: controller.signal },
        callback
      );
      await flush();
      expect(locks.pending).toHaveLength(1);

      controller.abort(new Error("gave up"));

      await expect(promise).rejects.toThrow("gave up");
      expect(locks.pending).toEqual([]);
      expect(callback).not.toHaveBeenCalled();
    });

    it("rejects with an AbortError when the signal has no reason", async () => {
      const locks = install();
      locks.hold("n");
      const controller = new AbortController();
      const promise = navigator.locks.request(
        "n",
        { signal: controller.signal },
        async () => {}
      );
      await flush();

      controller.abort();

      await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    });

    it("rejects at once when the signal is already aborted", async () => {
      const locks = install();
      const controller = new AbortController();
      controller.abort();
      const callback = vi.fn();

      await expect(
        navigator.locks.request("n", { signal: controller.signal }, callback)
      ).rejects.toMatchObject({ name: "AbortError" });

      expect(callback).not.toHaveBeenCalled();
      expect(locks.held).toEqual([]);
    });

    it("doesn't affect a request that was already granted", async () => {
      install();
      const controller = new AbortController();
      const hold = gate();
      const promise = navigator.locks.request(
        "n",
        { signal: controller.signal },
        async () => {
          await hold.promise;
          return "done";
        }
      );
      await flush();

      controller.abort();
      hold.open();

      expect(await promise).toBe("done");
    });

    it("lets the next request run when a waiting one is aborted", async () => {
      const locks = install();
      const holder = locks.hold("n");
      const controller = new AbortController();
      void navigator.locks
        .request("n", { signal: controller.signal }, async () => {})
        .catch(() => {});
      const next = vi.fn(async () => {});
      void navigator.locks.request("n", next);
      await flush();

      controller.abort();
      holder.release();
      await flush();

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("invalid options", () => {
    it.each([
      ["steal with ifAvailable", { steal: true, ifAvailable: true }],
      ["steal with a shared mode", { steal: true, mode: "shared" as const }],
      [
        "a signal with ifAvailable",
        { signal: new AbortController().signal, ifAvailable: true },
      ],
      [
        "a signal with steal",
        { signal: new AbortController().signal, steal: true },
      ],
    ])("rejects %s with a NotSupportedError", async (_label, options) => {
      install();
      const callback = vi.fn();

      await expect(
        navigator.locks.request("n", options, callback)
      ).rejects.toMatchObject({ name: "NotSupportedError" });
      expect(callback).not.toHaveBeenCalled();
    });

    it("rejects names that start with a dash", async () => {
      install();

      await expect(
        navigator.locks.request("-reserved", async () => {})
      ).rejects.toMatchObject({ name: "NotSupportedError" });
    });
  });

  describe("query", () => {
    it("returns a snapshot of the held and pending locks", async () => {
      const locks = install();
      locks.hold("a");
      void navigator.locks.request("a", { mode: "shared" }, async () => {});
      await flush();

      const state = await navigator.locks.query();

      expect(state.held).toEqual([{ name: "a", mode: "exclusive" }]);
      expect(state.pending).toEqual([{ name: "a", mode: "shared" }]);
    });

    it("returns a copy", async () => {
      const locks = install();
      locks.hold("a");
      await flush();

      const state = await navigator.locks.query();
      state.held?.pop();

      expect(locks.held).toHaveLength(1);
    });
  });

  describe("hold", () => {
    it("takes a lock that no code under test owns, and resolves granted", async () => {
      const locks = install();

      const lock = locks.hold("a", "shared");
      await lock.granted;

      expect(locks.held).toEqual([{ name: "a", mode: "shared" }]);
    });

    it("makes later requests wait until it is released", async () => {
      const locks = install();
      const lock = locks.hold("a");
      const callback = vi.fn(async () => {});
      void navigator.locks.request("a", callback);
      await flush();
      expect(callback).not.toHaveBeenCalled();

      lock.release();
      await flush();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("waits its turn behind earlier requests", async () => {
      const locks = install();
      const first = gate();
      void navigator.locks.request("a", () => first.promise);
      await flush();

      const lock = locks.hold("a");
      await flush();
      expect(locks.held.map((item) => item.name)).toEqual(["a"]);
      expect(locks.pending).toHaveLength(1);

      first.open();
      await lock.granted;

      expect(locks.pending).toHaveLength(0);
      expect(locks.held).toHaveLength(1);
    });

    it("withdraws a hold that is still waiting when it is released", async () => {
      const locks = install();
      locks.hold("a");
      const waiting = locks.hold("a");
      await flush();
      expect(locks.pending).toHaveLength(1);

      waiting.release();

      expect(locks.pending).toEqual([]);
      expect(locks.held).toHaveLength(1);
    });

    it("ignores releasing twice", async () => {
      const locks = install();
      const lock = locks.hold("a");
      await flush();

      lock.release();
      lock.release();

      expect(locks.held).toEqual([]);
    });
  });

  describe("releaseAll", () => {
    it("releases the locks held by hold for a name, and leaves other locks", async () => {
      const locks = install();
      locks.hold("a");
      locks.hold("b");
      const hold = gate();
      void navigator.locks.request("c", () => hold.promise);
      await flush();

      locks.releaseAll("a");

      expect(locks.held.map((lock) => lock.name)).toEqual(["b", "c"]);
      hold.open();
    });

    it("releases every hold when no name is given, and withdraws waiting ones", async () => {
      const locks = install();
      locks.hold("a");
      locks.hold("a");
      locks.hold("b");
      await flush();

      locks.releaseAll();

      expect(locks.held).toEqual([]);
      expect(locks.pending).toEqual([]);
    });

    it("lets a waiting request run", async () => {
      const locks = install();
      locks.hold("a");
      const callback = vi.fn(async () => {});
      void navigator.locks.request("a", callback);
      await flush();

      locks.releaseAll("a");
      await flush();

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("failNext", () => {
    it("rejects the next request with what it is given, then works again", async () => {
      const locks = install();
      const error = new Error("boom");
      locks.failNext(error);
      const callback = vi.fn(async () => "ok");

      await expect(navigator.locks.request("a", callback)).rejects.toBe(error);
      expect(callback).not.toHaveBeenCalled();
      expect(await navigator.locks.request("a", callback)).toBe("ok");
    });

    it("rejects with a plain Error by default, and covers one call each", async () => {
      const locks = install();
      locks.failNext();
      locks.failNext("second");

      await expect(
        navigator.locks.request("a", async () => {})
      ).rejects.toBeInstanceOf(Error);
      await expect(navigator.locks.request("a", async () => {})).rejects.toBe(
        "second"
      );
      await expect(
        navigator.locks.request("a", async () => "fine")
      ).resolves.toBe("fine");
      expect(locks.requests).toHaveLength(3);
    });
  });
});
