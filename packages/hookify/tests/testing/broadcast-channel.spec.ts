import { afterEach, describe, expect, it, vi } from "vitest";

import { installBroadcastChannel } from "@/testing";

/** Waits for the microtasks that deliveries run in. */
const flush = async () => {
  for (let index = 0; index < 3; index++) await Promise.resolve();
};

describe("installBroadcastChannel", () => {
  const controllers: { restore: () => void }[] = [];

  /** Installs the fake and restores it after the test. */
  const install = () => {
    const controller = installBroadcastChannel();
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
    it("replaces the global, and puts the original back on restore", () => {
      // Node has its own BroadcastChannel, so there is something to put back.
      const original = globalThis.BroadcastChannel;

      const channels = install();
      expect(globalThis.BroadcastChannel).not.toBe(original);

      channels.restore();
      expect(globalThis.BroadcastChannel).toBe(original);
    });

    it("removes the global again when there was none", () => {
      const descriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        "BroadcastChannel"
      )!;
      delete (globalThis as Record<string, unknown>).BroadcastChannel;

      try {
        const channels = install();
        expect(typeof BroadcastChannel).toBe("function");

        channels.restore();
        expect("BroadcastChannel" in globalThis).toBe(false);
      } finally {
        Object.defineProperty(globalThis, "BroadcastChannel", descriptor);
      }
    });

    it("does nothing when restore is called twice", () => {
      const original = globalThis.BroadcastChannel;
      const first = install();
      first.restore();
      const second = install();

      first.restore();

      expect(globalThis.BroadcastChannel).not.toBe(original);
      second.restore();
      expect(globalThis.BroadcastChannel).toBe(original);
    });

    it("closes every channel on restore", async () => {
      const channels = install();
      const received = vi.fn();
      const a = new BroadcastChannel("n");
      const b = new BroadcastChannel("n");
      b.onmessage = received;
      const peer = channels.peer("n");

      channels.restore();
      expect(channels.open).toEqual([]);
      expect(peer.closed).toBe(true);
      expect(() => a.postMessage("late")).toThrow(
        expect.objectContaining({ name: "InvalidStateError" })
      );
      await flush();

      expect(received).not.toHaveBeenCalled();
    });
  });

  describe("channels", () => {
    it("delivers a message to every other channel with the same name", async () => {
      install();
      const a = new BroadcastChannel("n");
      const b = new BroadcastChannel("n");
      const c = new BroadcastChannel("n");
      const onB = vi.fn();
      const onC = vi.fn();
      b.onmessage = onB;
      c.onmessage = onC;

      a.postMessage({ hello: "world" });
      await flush();

      expect(onB).toHaveBeenCalledTimes(1);
      expect(onB.mock.calls[0][0].data).toEqual({ hello: "world" });
      expect(onC).toHaveBeenCalledTimes(1);
    });

    it("never delivers a message to the channel that sent it", async () => {
      install();
      const a = new BroadcastChannel("n");
      const onA = vi.fn();
      a.onmessage = onA;
      const addEventListenerSpy = vi.fn();
      a.addEventListener("message", addEventListenerSpy);

      a.postMessage("x");
      await flush();

      expect(onA).not.toHaveBeenCalled();
      expect(addEventListenerSpy).not.toHaveBeenCalled();
    });

    it("doesn't deliver across different names", async () => {
      install();
      const a = new BroadcastChannel("one");
      const b = new BroadcastChannel("two");
      const onB = vi.fn();
      b.onmessage = onB;

      a.postMessage("x");
      await flush();

      expect(onB).not.toHaveBeenCalled();
    });

    it("delivers asynchronously", async () => {
      install();
      const a = new BroadcastChannel("n");
      const b = new BroadcastChannel("n");
      const onB = vi.fn();
      b.onmessage = onB;

      a.postMessage("x");
      expect(onB).not.toHaveBeenCalled();

      await flush();
      expect(onB).toHaveBeenCalledTimes(1);
    });

    it("delivers structured clones, so the receiver can't change the sender's object", async () => {
      install();
      const a = new BroadcastChannel("n");
      const b = new BroadcastChannel("n");
      const sent = { list: [1, 2] };
      let received: { list: number[] } | undefined;
      b.onmessage = (event) => {
        received = event.data;
      };

      a.postMessage(sent);
      await flush();

      expect(received).toEqual(sent);
      expect(received).not.toBe(sent);
      expect(received?.list).not.toBe(sent.list);
    });

    it("throws a DataCloneError for a value that can't be cloned", () => {
      install();
      const a = new BroadcastChannel("n");

      expect(() => a.postMessage(() => {})).toThrow(
        expect.objectContaining({ name: "DataCloneError" })
      );
    });

    it("supports addEventListener and removeEventListener for message", async () => {
      install();
      const a = new BroadcastChannel("n");
      const b = new BroadcastChannel("n");
      const listener = vi.fn();
      const object = { handleEvent: vi.fn() };
      b.addEventListener("message", listener);
      b.addEventListener("message", object);
      b.addEventListener("other", listener);

      a.postMessage("one");
      await flush();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(object.handleEvent).toHaveBeenCalledTimes(1);

      b.removeEventListener("message", listener);
      b.removeEventListener("other", listener);
      a.postMessage("two");
      await flush();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(object.handleEvent).toHaveBeenCalledTimes(2);
    });

    it("runs onmessage before the listeners", async () => {
      install();
      const a = new BroadcastChannel("n");
      const b = new BroadcastChannel("n");
      const order: string[] = [];
      b.onmessage = () => order.push("onmessage");
      b.addEventListener("message", () => order.push("listener"));

      a.postMessage("x");
      await flush();

      expect(order).toEqual(["onmessage", "listener"]);
    });

    it("dispatches a message event to its own listeners", () => {
      install();
      const a = new BroadcastChannel("n");
      const listener = vi.fn();
      a.addEventListener("message", listener);

      a.dispatchEvent(new MessageEvent("message", { data: "direct" }));

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].data).toBe("direct");
    });

    it("stops delivering to a closed channel, and throws when posting on it", async () => {
      install();
      const a = new BroadcastChannel("n");
      const b = new BroadcastChannel("n");
      const onB = vi.fn();
      b.onmessage = onB;

      b.close();
      a.postMessage("x");
      await flush();
      expect(onB).not.toHaveBeenCalled();

      expect(() => b.postMessage("y")).toThrow(
        expect.objectContaining({ name: "InvalidStateError" })
      );
    });

    it("doesn't deliver a message that was in flight when the channel closed", async () => {
      install();
      const a = new BroadcastChannel("n");
      const b = new BroadcastChannel("n");
      const onB = vi.fn();
      b.onmessage = onB;

      a.postMessage("x");
      b.close();
      await flush();

      expect(onB).not.toHaveBeenCalled();
    });

    it("exposes its name", () => {
      install();

      expect(new BroadcastChannel("hello").name).toBe("hello");
    });
  });

  describe("open and posted", () => {
    it("lists the names of the open channels, and drops closed ones", () => {
      const channels = install();
      const a = new BroadcastChannel("one");
      new BroadcastChannel("two");
      new BroadcastChannel("two");

      expect(channels.open).toEqual(["one", "two", "two"]);

      a.close();
      expect(channels.open).toEqual(["two", "two"]);
    });

    it("records what the code under test posted, but not what peers post", () => {
      const channels = install();
      const a = new BroadcastChannel("n");
      const peer = channels.peer("n");

      a.postMessage({ x: 1 });
      peer.post("from peer");

      expect(channels.posted).toEqual([{ channel: "n", data: { x: 1 } }]);
    });
  });

  describe("peer", () => {
    it("receives what other channels post", async () => {
      const channels = install();
      const peer = channels.peer("n");
      const a = new BroadcastChannel("n");

      a.postMessage({ type: "hello" });
      a.postMessage("two");
      await flush();

      expect(peer.received).toEqual([{ type: "hello" }, "two"]);
      expect(peer.name).toBe("n");
    });

    it("posts to the code under test, but not to itself", async () => {
      const channels = install();
      const peer = channels.peer("n");
      const a = new BroadcastChannel("n");
      const onA = vi.fn();
      a.onmessage = onA;

      peer.post("hi");
      await flush();

      expect(onA).toHaveBeenCalledTimes(1);
      expect(onA.mock.calls[0][0].data).toBe("hi");
      expect(peer.received).toEqual([]);
    });

    it("clones what it posts", async () => {
      const channels = install();
      const peer = channels.peer("n");
      const a = new BroadcastChannel("n");
      const sent = { x: 1 };
      let received: unknown;
      a.onmessage = (event) => {
        received = event.data;
      };

      peer.post(sent);
      await flush();

      expect(received).toEqual(sent);
      expect(received).not.toBe(sent);
    });

    it("lets several peers talk to each other", async () => {
      const channels = install();
      const first = channels.peer("n");
      const second = channels.peer("n");

      first.post("ping");
      await flush();

      expect(second.received).toEqual(["ping"]);
      expect(first.received).toEqual([]);
    });

    it("stops receiving and sending when it closes, and closing twice does nothing", async () => {
      const channels = install();
      const peer = channels.peer("n");
      const a = new BroadcastChannel("n");
      const onA = vi.fn();
      a.onmessage = onA;

      peer.close();
      peer.close();
      a.postMessage("x");
      await flush();

      expect(peer.closed).toBe(true);
      expect(peer.received).toEqual([]);
      expect(channels.open).toEqual(["n"]);
      expect(() => peer.post("y")).toThrow(
        expect.objectContaining({ name: "InvalidStateError" })
      );
    });

    it("doesn't receive a message that was in flight when it closed", async () => {
      const channels = install();
      const peer = channels.peer("n");
      const a = new BroadcastChannel("n");

      a.postMessage("x");
      peer.close();
      await flush();

      expect(peer.received).toEqual([]);
    });

    it("can have its received list cleared", async () => {
      const channels = install();
      const peer = channels.peer("n");
      const a = new BroadcastChannel("n");
      a.postMessage("one");
      await flush();

      peer.received.length = 0;
      a.postMessage("two");
      await flush();

      expect(peer.received).toEqual(["two"]);
    });
  });
});
