import { act, renderHook } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isAbortError, useWebLock } from "@/hooks";

const abortError = () => new DOMException("Aborted", "AbortError");

const deferred = <T = void>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

interface Held {
  name: string;
  mode: LockMode;
  abort: (reason: unknown) => void;
}

interface Queued {
  name: string;
  mode: LockMode;
  grant: () => void;
}

// A small in-memory stand-in for `navigator.locks` with the semantics the hook
// relies on: FIFO queueing, shared/exclusive modes, `ifAvailable`, `steal`
// and abort signals.
const createFakeLockManager = () => {
  const held: Held[] = [];
  const queue: Queued[] = [];

  const canGrant = (name: string, mode: LockMode) => {
    const holders = held.filter((entry) => entry.name === name);
    return (
      holders.length === 0 ||
      (mode === "shared" && holders.every((entry) => entry.mode === "shared"))
    );
  };

  const pump = () => {
    const blocked = new Set<string>();
    for (const request of [...queue]) {
      if (!blocked.has(request.name) && canGrant(request.name, request.mode)) {
        queue.splice(queue.indexOf(request), 1);
        request.grant();
      } else {
        blocked.add(request.name);
      }
    }
  };

  const request = vi.fn(
    (
      name: string,
      options: LockOptions,
      callback: LockGrantedCallback<unknown>
    ) =>
      new Promise((resolve, reject) => {
        const mode = options.mode ?? "exclusive";

        const grant = (onDone?: () => void) => {
          let settled = false;
          const entry: Held = {
            name,
            mode,
            abort: (reason) => {
              if (settled) return;
              settled = true;
              reject(reason);
            },
          };
          held.push(entry);
          const release = () => {
            held.splice(held.indexOf(entry), 1);
            onDone?.();
            pump();
          };
          Promise.resolve()
            .then(() => callback({ name, mode } as Lock))
            .then(
              (value) => {
                if (!settled) resolve(value);
                settled = true;
                release();
              },
              (error) => {
                if (!settled) reject(error);
                settled = true;
                release();
              }
            );
        };

        if (options.signal?.aborted) {
          reject(options.signal.reason);
        } else if (options.steal) {
          held
            .filter((entry) => entry.name === name)
            .forEach((entry) => {
              entry.abort(abortError());
              held.splice(held.indexOf(entry), 1);
            });
          grant();
        } else if (
          canGrant(name, mode) &&
          !queue.some((q) => q.name === name)
        ) {
          grant();
        } else if (options.ifAvailable) {
          Promise.resolve()
            .then(() => callback(null))
            .then(resolve, reject);
        } else {
          const queued: Queued = { name, mode, grant };
          queue.push(queued);
          options.signal?.addEventListener("abort", () => {
            const index = queue.indexOf(queued);
            if (index === -1) return;
            queue.splice(index, 1);
            reject(options.signal?.reason);
          });
        }
      })
  );

  return { request, held, queue };
};

describe("useWebLock", () => {
  let locks: ReturnType<typeof createFakeLockManager>;

  beforeEach(() => {
    locks = createFakeLockManager();
    Object.defineProperty(navigator, "locks", {
      value: locks,
      configurable: true,
    });
  });

  afterEach(() => {
    // jsdom has no Web Locks API, so remove the property rather than leaving
    // a stub behind for other test files.
    delete (navigator as { locks?: unknown }).locks;
  });

  it("starts idle", () => {
    const { result } = renderHook(() => useWebLock("a"));
    expect(result.current.isHeld).toBe(false);
    expect(result.current.isPending).toBe(false);
  });

  it("runs fn while holding the lock and resolves its value", async () => {
    const { result } = renderHook(() => useWebLock("a"));
    const fn = vi.fn().mockResolvedValue(42);

    let value: unknown;
    await act(async () => {
      value = await result.current.run(fn);
    });

    expect(value).toBe(42);
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ name: "a" }),
      expect.any(AbortSignal)
    );
    expect(locks.held).toHaveLength(0);
  });

  it("accepts a synchronous fn", async () => {
    const { result } = renderHook(() => useWebLock("a"));

    let value: unknown;
    await act(async () => {
      value = await result.current.run(() => "sync");
    });

    expect(value).toBe("sync");
  });

  it("releases the lock and rethrows when fn rejects", async () => {
    const { result } = renderHook(() => useWebLock("a"));
    const failure = new Error("boom");

    let caught: unknown;
    await act(async () => {
      caught = await result.current
        .run(() => Promise.reject(failure))
        .catch((error: unknown) => error);
    });

    expect(caught).toBe(failure);
    expect(locks.held).toHaveLength(0);
    expect(result.current.isHeld).toBe(false);
  });

  it("tracks isPending and isHeld", async () => {
    const { result } = renderHook(() => useWebLock("a"));
    const gate = deferred();

    let promise!: Promise<unknown>;
    act(() => {
      promise = result.current.run(() => gate.promise);
    });
    expect(result.current.isPending).toBe(true);
    expect(result.current.isHeld).toBe(false);

    await act(async () => {});
    expect(result.current.isPending).toBe(false);
    expect(result.current.isHeld).toBe(true);

    await act(async () => {
      gate.resolve();
      await promise;
    });
    expect(result.current.isPending).toBe(false);
    expect(result.current.isHeld).toBe(false);
  });

  it("serializes exclusive runs of the same name", async () => {
    const first = renderHook(() => useWebLock("a"));
    const second = renderHook(() => useWebLock("a"));
    const gate = deferred();
    const order: string[] = [];

    let secondDone!: Promise<unknown>;
    let firstDone!: Promise<unknown>;
    act(() => {
      firstDone = first.result.current.run(async () => {
        order.push("first:start");
        await gate.promise;
        order.push("first:end");
      });
      secondDone = second.result.current.run(async () => {
        order.push("second:start");
      });
    });
    await act(async () => {});

    expect(order).toEqual(["first:start"]);
    expect(second.result.current.isPending).toBe(true);

    await act(async () => {
      gate.resolve();
      await Promise.all([firstDone, secondDone]);
    });

    expect(order).toEqual(["first:start", "first:end", "second:start"]);
    expect(second.result.current.isPending).toBe(false);
  });

  it("does not block different names", async () => {
    const first = renderHook(() => useWebLock("a"));
    const second = renderHook(() => useWebLock("b"));
    const gate = deferred();
    const fn = vi.fn();

    act(() => {
      void first.result.current.run(() => gate.promise);
    });
    await act(async () => {
      await second.result.current.run(fn);
    });

    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => {
      gate.resolve();
    });
  });

  it("lets shared runs hold the lock concurrently", async () => {
    const first = renderHook(() => useWebLock("a", { mode: "shared" }));
    const second = renderHook(() => useWebLock("a", { mode: "shared" }));
    const gate = deferred();
    const fnA = vi.fn(() => gate.promise);
    const fnB = vi.fn(() => gate.promise);

    act(() => {
      void first.result.current.run(fnA);
      void second.result.current.run(fnB);
    });
    await act(async () => {});

    expect(fnA).toHaveBeenCalledTimes(1);
    expect(fnB).toHaveBeenCalledTimes(1);
    expect(first.result.current.isHeld).toBe(true);
    expect(second.result.current.isHeld).toBe(true);

    await act(async () => {
      gate.resolve();
    });
  });

  it("keeps isHeld and isPending true until every call from one hook is done", async () => {
    const { result } = renderHook(() => useWebLock("a", { mode: "shared" }));
    const gateA = deferred();
    const gateB = deferred();

    let a!: Promise<unknown>;
    let b!: Promise<unknown>;
    await act(async () => {
      a = result.current.run(() => gateA.promise);
      b = result.current.run(() => gateB.promise);
    });
    expect(result.current.isHeld).toBe(true);

    await act(async () => {
      gateA.resolve();
      await a;
    });
    expect(result.current.isHeld).toBe(true);

    await act(async () => {
      gateB.resolve();
      await b;
    });
    expect(result.current.isHeld).toBe(false);
  });

  it("skips the work and resolves undefined when ifAvailable finds the lock held", async () => {
    const holder = renderHook(() => useWebLock("a"));
    const skipper = renderHook(() => useWebLock("a", { ifAvailable: true }));
    const gate = deferred();
    const fn = vi.fn();

    act(() => {
      void holder.result.current.run(() => gate.promise);
    });
    await act(async () => {});

    let value: unknown = "unset";
    await act(async () => {
      value = await skipper.result.current.run(fn);
    });

    expect(value).toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
    expect(skipper.result.current.isPending).toBe(false);
    expect(skipper.result.current.isHeld).toBe(false);

    await act(async () => {
      gate.resolve();
    });
  });

  it("runs the work with ifAvailable when the lock is free", async () => {
    const { result } = renderHook(() => useWebLock("a", { ifAvailable: true }));

    let value: unknown;
    await act(async () => {
      value = await result.current.run(() => "done");
    });

    expect(value).toBe("done");
  });

  it("passes only the set options to navigator.locks.request", async () => {
    const { result } = renderHook(() => useWebLock("a", { mode: "shared" }));

    await act(async () => {
      await result.current.run(() => {});
    });

    expect(locks.request).toHaveBeenCalledWith(
      "a",
      { mode: "shared", signal: expect.any(AbortSignal) },
      expect.any(Function)
    );
  });

  it("lets run options override the hook options", async () => {
    const { result } = renderHook(() => useWebLock("a", { mode: "shared" }));

    await act(async () => {
      await result.current.run(() => {}, { mode: "exclusive" });
      await result.current.run(() => {}, { ifAvailable: true });
    });

    expect(locks.request).toHaveBeenNthCalledWith(
      1,
      "a",
      { mode: "exclusive", signal: expect.any(AbortSignal) },
      expect.any(Function)
    );
    expect(locks.request).toHaveBeenNthCalledWith(
      2,
      "a",
      { mode: "shared", ifAvailable: true },
      expect.any(Function)
    );
  });

  it("uses the latest hook options without changing run's identity", async () => {
    const { result, rerender } = renderHook(
      ({ mode }: { mode: LockMode }) => useWebLock("a", { mode }),
      { initialProps: { mode: "exclusive" as LockMode } }
    );
    const run = result.current.run;

    rerender({ mode: "shared" });
    expect(result.current.run).toBe(run);

    await act(async () => {
      await result.current.run(() => {});
    });
    expect(locks.request).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({ mode: "shared" }),
      expect.any(Function)
    );
  });

  it("changes run's identity and uses the new name when name changes", async () => {
    const { result, rerender } = renderHook(
      ({ name }: { name: string }) => useWebLock(name),
      { initialProps: { name: "a" } }
    );
    const run = result.current.run;

    rerender({ name: "b" });
    expect(result.current.run).not.toBe(run);

    await act(async () => {
      await result.current.run(() => {});
    });
    expect(locks.request).toHaveBeenCalledWith(
      "b",
      expect.anything(),
      expect.any(Function)
    );
  });

  it("steals the lock without passing a signal", async () => {
    const holder = renderHook(() => useWebLock("a"));
    const thief = renderHook(() => useWebLock("a", { steal: true }));
    const fn = vi.fn();

    let held!: Promise<unknown>;
    act(() => {
      held = holder.result.current.run(() => new Promise(() => {}));
    });
    await act(async () => {});

    let heldError: unknown;
    await act(async () => {
      const heldSettled = held.catch((error: unknown) => {
        heldError = error;
      });
      await thief.result.current.run(fn);
      await heldSettled;
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(isAbortError(heldError)).toBe(true);
    expect(locks.request).toHaveBeenLastCalledWith(
      "a",
      { steal: true },
      expect.any(Function)
    );
  });

  it("aborts a pending request on unmount and rejects with an AbortError", async () => {
    const holder = renderHook(() => useWebLock("a"));
    const waiter = renderHook(() => useWebLock("a"));
    const gate = deferred();
    const fn = vi.fn();

    act(() => {
      void holder.result.current.run(() => gate.promise);
    });
    await act(async () => {});

    let waiting!: Promise<unknown>;
    act(() => {
      waiting = waiter.result.current.run(fn);
    });
    const settled = waiting.then(
      () => undefined,
      (error: unknown) => error
    );

    waiter.unmount();
    expect(isAbortError(await settled)).toBe(true);

    await act(async () => {
      gate.resolve();
    });
    expect(fn).not.toHaveBeenCalled();
    expect(locks.queue).toHaveLength(0);
  });

  it("aborts the signal given to fn on unmount but leaves the held lock alone", async () => {
    const { result, unmount } = renderHook(() => useWebLock("a"));
    const gate = deferred();
    let signal!: AbortSignal;

    let promise!: Promise<unknown>;
    await act(async () => {
      promise = result.current.run((_lock, s) => {
        signal = s;
        return gate.promise;
      });
    });
    expect(signal.aborted).toBe(false);

    unmount();
    expect(signal.aborted).toBe(true);
    expect(locks.held).toHaveLength(1);

    gate.resolve();
    await promise;
    expect(locks.held).toHaveLength(0);
  });

  it("does not update state after unmount", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useWebLock("a"));
    const gate = deferred();

    let promise!: Promise<unknown>;
    await act(async () => {
      promise = result.current.run(() => gate.promise);
    });

    unmount();
    gate.resolve();
    await promise;

    expect(error).not.toHaveBeenCalled();
  });

  it("rejects a run started after unmount with an AbortError", async () => {
    const { result, unmount } = renderHook(() => useWebLock("a"));
    const fn = vi.fn();
    unmount();

    const error = await result.current.run(fn).catch((e: unknown) => e);

    expect(isAbortError(error)).toBe(true);
    expect(fn).not.toHaveBeenCalled();
  });

  describe("with a caller signal", () => {
    it("aborts a pending request and rejects with the signal's reason", async () => {
      const holder = renderHook(() => useWebLock("a"));
      const waiter = renderHook(() => useWebLock("a"));
      const gate = deferred();
      const controller = new AbortController();

      act(() => {
        void holder.result.current.run(() => gate.promise);
      });
      await act(async () => {});

      let waiting!: Promise<unknown>;
      act(() => {
        waiting = waiter.result.current.run(() => {}, {
          signal: controller.signal,
        });
      });
      const settled = waiting.then(
        () => undefined,
        (error: unknown) => error
      );

      const reason = new Error("cancelled");
      await act(async () => {
        controller.abort(reason);
      });

      expect(await settled).toBe(reason);
      expect(waiter.result.current.isPending).toBe(false);

      await act(async () => {
        gate.resolve();
      });
    });

    it("rejects without requesting the lock when the signal is already aborted", async () => {
      const { result } = renderHook(() =>
        useWebLock("a", { ifAvailable: true })
      );
      const fn = vi.fn();
      const reason = new Error("early");

      const error = await result.current
        .run(fn, { signal: AbortSignal.abort(reason) })
        .catch((e: unknown) => e);

      expect(error).toBe(reason);
      expect(locks.request).not.toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
    });

    it("forwards the abort to the signal given to fn", async () => {
      const { result } = renderHook(() => useWebLock("a"));
      const controller = new AbortController();
      const gate = deferred();
      let signal!: AbortSignal;

      let promise!: Promise<unknown>;
      await act(async () => {
        promise = result.current.run(
          (_lock, s) => {
            signal = s;
            return gate.promise;
          },
          { signal: controller.signal }
        );
      });

      controller.abort();
      expect(signal.aborted).toBe(true);

      gate.resolve();
      await promise;
    });

    it("stops listening to the caller's signal once the call settles", async () => {
      const { result } = renderHook(() => useWebLock("a"));
      const controller = new AbortController();
      const remove = vi.spyOn(controller.signal, "removeEventListener");

      await act(async () => {
        await result.current.run(() => {}, { signal: controller.signal });
      });

      expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    });
  });

  describe("without the Web Locks API", () => {
    beforeEach(() => {
      delete (navigator as { locks?: unknown }).locks;
    });

    it("runs fn directly with a null lock", async () => {
      const { result } = renderHook(() => useWebLock("a"));
      const fn = vi.fn().mockResolvedValue("ok");

      let value: unknown;
      await act(async () => {
        value = await result.current.run(fn);
      });

      expect(value).toBe("ok");
      expect(fn).toHaveBeenCalledWith(null, expect.any(AbortSignal));
      expect(result.current.isHeld).toBe(false);
      expect(result.current.isPending).toBe(false);
    });

    it("runs fn even with ifAvailable", async () => {
      const { result } = renderHook(() =>
        useWebLock("a", { ifAvailable: true })
      );

      let value: unknown;
      await act(async () => {
        value = await result.current.run(() => "ok");
      });

      expect(value).toBe("ok");
    });
  });

  it("renders on the server without touching navigator.locks", () => {
    const Demo = () => {
      const { isHeld, isPending } = useWebLock("a");
      return createElement("span", null, `${isHeld}-${isPending}`);
    };

    expect(renderToString(createElement(Demo))).toContain("false-false");
    expect(locks.request).not.toHaveBeenCalled();
  });

  it("works under StrictMode", async () => {
    const { result } = renderHook(() => useWebLock("a"), {
      wrapper: StrictMode,
    });

    let value: unknown;
    await act(async () => {
      value = await result.current.run(() => "ok");
    });

    expect(value).toBe("ok");
    expect(result.current.isHeld).toBe(false);
    expect(locks.held).toHaveLength(0);
  });
});
