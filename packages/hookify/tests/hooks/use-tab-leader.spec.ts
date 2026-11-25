import { act, cleanup, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTabLeader, type UseTabLeaderOptions } from "@/hooks";
import {
  type BroadcastChannelController,
  installBroadcastChannel,
  installWebLocks,
  type WebLocksController,
} from "@/testing";

let channels: BroadcastChannelController;
let locks: WebLocksController;
/** Whether `locks` was installed by the current test, so it must be restored. */
let locksInstalled = false;

/** Installs the Web Locks fake for the current test. */
const useLocks = () => {
  locks = installWebLocks();
  locksInstalled = true;
};

/** A tab that isn't running the hook, for scripting what other tabs send. */
const createPeer = (key: string) => channels.peer(`hookify:tab-leader:${key}`);

const settle = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const render = (
  key = "k",
  options?: UseTabLeaderOptions,
  extra?: { reactStrictMode?: boolean }
) =>
  renderHook(
    (props: { key: string; options?: UseTabLeaderOptions }) =>
      useTabLeader(props.key, props.options),
    { initialProps: { key, options }, ...extra }
  );

describe("useTabLeader", () => {
  beforeEach(() => {
    channels = installBroadcastChannel();
  });

  afterEach(() => {
    cleanup();
    channels.restore();
    if (locksInstalled) locks.restore();
    locksInstalled = false;
  });

  it("is not the leader during server rendering", () => {
    const Probe = () => {
      const { isLeader, leaderId, id } = useTabLeader("k");
      return createElement("p", null, `${isLeader}|${leaderId}|${id}`);
    };

    expect(renderToString(createElement(Probe))).toContain("false|null|null");
  });

  describe("with Web Locks", () => {
    beforeEach(() => {
      useLocks();
    });

    it("elects a lone instance and calls onElected once", async () => {
      const onElected = vi.fn();
      const onDemoted = vi.fn();
      const { result } = render("k", { onElected, onDemoted });

      expect(result.current.isLeader).toBe(false);
      expect(result.current.id).toEqual(expect.any(String));

      await settle();

      expect(result.current.isLeader).toBe(true);
      expect(result.current.leaderId).toBe(result.current.id);
      expect(onElected).toHaveBeenCalledTimes(1);
      expect(onDemoted).not.toHaveBeenCalled();
      expect(locks.requests).toEqual([
        {
          name: "hookify:tab-leader:k",
          options: { signal: expect.any(AbortSignal) },
        },
      ]);
    });

    it("elects exactly one leader and tells followers who it is", async () => {
      const first = render("k");
      await settle();
      const second = render("k");
      await settle();

      expect(first.result.current.isLeader).toBe(true);
      expect(second.result.current.isLeader).toBe(false);
      expect(second.result.current.leaderId).toBe(first.result.current.id);
      expect(second.result.current.id).not.toBe(first.result.current.id);
    });

    it("elects independent leaders for different keys", async () => {
      const a = render("a");
      const b = render("b");
      await settle();

      expect(a.result.current.isLeader).toBe(true);
      expect(b.result.current.isLeader).toBe(true);
    });

    it("hands leadership to a waiting instance when the leader unmounts", async () => {
      const leaderDemoted = vi.fn();
      const followerElected = vi.fn();
      const leader = render("k", { onDemoted: leaderDemoted });
      await settle();
      const follower = render("k", { onElected: followerElected });
      await settle();
      expect(followerElected).not.toHaveBeenCalled();

      leader.unmount();
      await settle();

      expect(leaderDemoted).toHaveBeenCalledTimes(1);
      expect(follower.result.current.isLeader).toBe(true);
      expect(follower.result.current.leaderId).toBe(follower.result.current.id);
      expect(followerElected).toHaveBeenCalledTimes(1);
    });

    it("updates the leader id of followers when leadership moves", async () => {
      const leader = render("k");
      await settle();
      const second = render("k");
      const third = render("k");
      await settle();

      leader.unmount();
      await settle();

      const leaders = [second, third].filter(
        ({ result }) => result.current.isLeader
      );
      expect(leaders).toHaveLength(1);
      const [newLeader] = leaders;
      const follower = newLeader === second ? third : second;
      expect(follower.result.current.leaderId).toBe(
        newLeader.result.current.id
      );
    });

    it("leads again when the key changes and demotes from the old key", async () => {
      const onElected = vi.fn();
      const onDemoted = vi.fn();
      const { result, rerender } = render("a", { onElected, onDemoted });
      await settle();
      const firstId = result.current.id;

      await act(async () => {
        rerender({ key: "b", options: { onElected, onDemoted } });
      });
      await settle();

      expect(onDemoted).toHaveBeenCalledTimes(1);
      expect(onElected).toHaveBeenCalledTimes(2);
      expect(result.current.isLeader).toBe(true);
      expect(result.current.id).not.toBe(firstId);
      expect(locks.held).toEqual([
        { name: "hookify:tab-leader:b", mode: "exclusive" },
      ]);
    });

    it("steps down while disabled and takes part again when enabled", async () => {
      const onDemoted = vi.fn();
      const { result, rerender } = render("k", { onDemoted });
      await settle();

      rerender({ key: "k", options: { enabled: false, onDemoted } });
      await settle();

      expect(result.current).toMatchObject({
        isLeader: false,
        leaderId: null,
        id: null,
      });
      expect(onDemoted).toHaveBeenCalledTimes(1);
      expect(locks.held).toHaveLength(0);

      rerender({ key: "k", options: { enabled: true, onDemoted } });
      await settle();

      expect(result.current.isLeader).toBe(true);
    });

    it("does not request a lock while disabled", async () => {
      const { result } = render("k", { enabled: false });
      await settle();

      expect(locks.requests).toHaveLength(0);
      expect(result.current.isLeader).toBe(false);
    });

    it("releases the lock and removes a waiting request on unmount", async () => {
      const leader = render("k");
      await settle();
      const follower = render("k");
      await settle();
      expect(locks.pending).toHaveLength(1);

      follower.unmount();
      expect(locks.pending).toHaveLength(0);

      leader.unmount();
      await settle();
      expect(locks.held).toHaveLength(0);
    });

    it("keeps exactly one leader and balanced callbacks in StrictMode", async () => {
      const onElected = vi.fn();
      const onDemoted = vi.fn();
      const { result, unmount } = render(
        "k",
        { onElected, onDemoted },
        { reactStrictMode: true }
      );
      await settle();

      expect(result.current.isLeader).toBe(true);
      expect(onElected.mock.calls.length).toBe(onDemoted.mock.calls.length + 1);

      unmount();
      await settle();

      expect(onElected.mock.calls.length).toBe(onDemoted.mock.calls.length);
      expect(locks.held).toHaveLength(0);
    });

    it("calls the latest callbacks without re-electing", async () => {
      const first = vi.fn();
      const second = vi.fn();
      const { rerender } = render("k", { onDemoted: first });
      await settle();

      rerender({ key: "k", options: { onDemoted: second } });
      await settle();
      expect(locks.requests).toHaveLength(1);

      rerender({ key: "k", options: { enabled: false, onDemoted: second } });
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });

    it("keeps the election going when a callback throws", async () => {
      const failure = new Error("boom");
      const { result } = render("k", {
        onElected: () => {
          throw failure;
        },
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.isLeader).toBe(true);
      expect(locks.held).toHaveLength(1);
      expect(() => vi.runAllTimers()).toThrow(failure);
    });

    it("leads alone when the lock request fails", async () => {
      locks.failNext(new DOMException("Denied", "SecurityError"));
      const onElected = vi.fn();
      const { result } = render("k", { onElected });
      await settle();

      expect(result.current.isLeader).toBe(true);
      expect(onElected).toHaveBeenCalledTimes(1);
    });

    it("ignores other leader announcements while holding the lock", async () => {
      const { result } = render("k");
      await settle();
      const peer = createPeer("k");

      peer.post({ type: "leader", id: "intruder" });
      await settle();

      expect(result.current.isLeader).toBe(true);
    });

    it("answers a hello from a new tab with the leader id", async () => {
      const { result } = render("k");
      await settle();
      const peer = createPeer("k");

      peer.post({ type: "hello" });
      await settle();

      expect(peer.received).toContainEqual({
        type: "leader",
        id: result.current.id,
      });
    });

    it("lets only the leader answer a hello and ignores malformed messages", async () => {
      const leader = render("k");
      await settle();
      const follower = render("k");
      await settle();
      const peer = createPeer("k");

      peer.post({ type: "hello" });
      peer.post("garbage");
      peer.post(null);
      await settle();

      expect(peer.received).toEqual([
        { type: "leader", id: leader.result.current.id },
      ]);
      expect(follower.result.current.leaderId).toBe(leader.result.current.id);
    });

    it("leaves leaderId unknown for followers without BroadcastChannel", async () => {
      vi.stubGlobal("BroadcastChannel", undefined);
      const leader = render("k");
      await settle();
      const follower = render("k");
      await settle();

      expect(leader.result.current.isLeader).toBe(true);
      expect(follower.result.current.isLeader).toBe(false);
      expect(follower.result.current.leaderId).toBeNull();
    });
  });

  describe("with the BroadcastChannel fallback", () => {
    it("elects a lone instance after the discovery delay", async () => {
      const onElected = vi.fn();
      const { result } = render("k", { onElected });

      await settle(100);
      expect(result.current.isLeader).toBe(false);

      await settle(400);
      expect(result.current.isLeader).toBe(true);
      expect(onElected).toHaveBeenCalledTimes(1);
    });

    it("lets the oldest tab lead and the newcomer follow", async () => {
      const first = render("k");
      await settle(500);
      const second = render("k");
      await settle(500);

      expect(first.result.current.isLeader).toBe(true);
      expect(second.result.current.isLeader).toBe(false);
      expect(second.result.current.leaderId).toBe(first.result.current.id);
    });

    it("hands over immediately when the leader unmounts", async () => {
      const onDemoted = vi.fn();
      const leader = render("k", { onDemoted });
      await settle(500);
      const follower = render("k");
      await settle(500);

      leader.unmount();
      await settle();

      expect(onDemoted).toHaveBeenCalledTimes(1);
      expect(follower.result.current.isLeader).toBe(true);
    });

    it("takes over when the leader stops pinging", async () => {
      const peer = createPeer("k");
      const ping = () => peer.post({ type: "ping", id: "old", since: 0 });
      const { result } = render("k");
      ping();
      await settle(500);

      expect(result.current.isLeader).toBe(false);
      expect(result.current.leaderId).toBe("old");

      // Still alive: it keeps pinging, so the follower keeps waiting.
      for (let i = 0; i < 5; i++) {
        ping();
        await settle(1000);
      }
      expect(result.current.leaderId).toBe("old");

      await settle(4000);
      expect(result.current.isLeader).toBe(true);
    });

    it("steps down when an older tab shows up", async () => {
      const onDemoted = vi.fn();
      const { result } = render("k", { onDemoted });
      await settle(500);
      expect(result.current.isLeader).toBe(true);

      createPeer("k").post({
        type: "ping",
        id: "older",
        since: 0,
      });
      await settle();

      expect(result.current.isLeader).toBe(false);
      expect(result.current.leaderId).toBe("older");
      expect(onDemoted).toHaveBeenCalledTimes(1);
    });

    it("breaks ties between tabs started together by id", async () => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue(
        "b" as ReturnType<typeof crypto.randomUUID>
      );
      const peer = createPeer("k");
      const { result } = render("k");
      const since = Date.now();

      peer.post({ type: "ping", id: "c", since });
      await settle(500);
      expect(result.current.isLeader).toBe(true);

      peer.post({ type: "ping", id: "a", since });
      await settle();
      expect(result.current.leaderId).toBe("a");
    });

    it("answers a hello with a ping", async () => {
      const { result } = render("k");
      const peer = createPeer("k");
      await settle();
      peer.received.length = 0;

      peer.post({ type: "hello" });
      await settle();

      expect(peer.received).toEqual([
        { type: "ping", id: result.current.id, since: expect.any(Number) },
      ]);
    });

    it("forgets a tab that says goodbye and ignores leader announcements", async () => {
      const peer = createPeer("k");
      const { result } = render("k");
      peer.post({ type: "ping", id: "old", since: 0 });
      await settle(500);
      expect(result.current.leaderId).toBe("old");

      peer.post({ type: "leader", id: "other" });
      await settle();
      expect(result.current.leaderId).toBe("old");

      peer.post({ type: "bye", id: "old" });
      await settle();
      expect(result.current.isLeader).toBe(true);
    });

    it("says goodbye and stops pinging on unmount", async () => {
      const peer = createPeer("k");
      const { unmount } = render("k");
      await settle(500);

      unmount();
      await settle();
      expect(peer.received.at(-1)).toMatchObject({ type: "bye" });

      peer.received.length = 0;
      await settle(5000);
      expect(peer.received).toHaveLength(0);
    });

    it("stays correct in StrictMode", async () => {
      const onElected = vi.fn();
      const onDemoted = vi.fn();
      const { result, unmount } = render(
        "k",
        { onElected, onDemoted },
        { reactStrictMode: true }
      );
      await settle(500);

      expect(result.current.isLeader).toBe(true);
      expect(onElected.mock.calls.length).toBe(onDemoted.mock.calls.length + 1);

      unmount();
      expect(onElected.mock.calls.length).toBe(onDemoted.mock.calls.length);
    });
  });

  describe("without Web Locks or BroadcastChannel", () => {
    beforeEach(() => {
      vi.stubGlobal("BroadcastChannel", undefined);
    });

    it("treats the page as a single tab and makes it the leader", async () => {
      const onElected = vi.fn();
      const onDemoted = vi.fn();
      const { result, unmount } = render("k", { onElected, onDemoted });

      expect(result.current.isLeader).toBe(true);
      expect(onElected).toHaveBeenCalledTimes(1);

      unmount();
      expect(onDemoted).toHaveBeenCalledTimes(1);
    });

    it("does nothing when broadcasting", () => {
      const { result } = render("k");

      expect(() => result.current.broadcast("hi")).not.toThrow();
    });

    it("falls back to a single tab when BroadcastChannel can't be created", () => {
      vi.stubGlobal(
        "BroadcastChannel",
        class {
          constructor() {
            throw new DOMException("Denied", "SecurityError");
          }
        }
      );
      const { result } = render("k");

      expect(result.current.isLeader).toBe(true);
    });

    it("generates an id without crypto.randomUUID", () => {
      vi.stubGlobal("crypto", {});
      const { result } = render("k");

      expect(result.current.id).toEqual(expect.any(String));
      expect(result.current.id).not.toBe("");
    });
  });

  describe("messaging", () => {
    beforeEach(() => {
      useLocks();
    });

    it("delivers broadcasts to other tabs but not the sender", async () => {
      const onSenderMessage = vi.fn();
      const onReceiverMessage = vi.fn();
      const sender = render("k", { onMessage: onSenderMessage });
      const receiver = render("k", { onMessage: onReceiverMessage });
      await settle();

      act(() => sender.result.current.broadcast({ price: 42 }));
      await settle();

      expect(onReceiverMessage).toHaveBeenCalledWith(
        { price: 42 },
        sender.result.current.id
      );
      expect(onSenderMessage).not.toHaveBeenCalled();
      expect(receiver.result.current.isLeader).toBe(false);
    });

    it("does not deliver across keys", async () => {
      const onMessage = vi.fn();
      const sender = render("a");
      render("b", { onMessage });
      await settle();

      sender.result.current.broadcast("hi");
      await settle();

      expect(onMessage).not.toHaveBeenCalled();
    });

    it("keeps a stable broadcast and calls the latest onMessage", async () => {
      const first = vi.fn();
      const second = vi.fn();
      const sender = render("k");
      const receiver = render("k", { onMessage: first });
      await settle();
      const { broadcast } = sender.result.current;

      receiver.rerender({ key: "k", options: { onMessage: second } });
      sender.rerender({ key: "k", options: undefined });
      broadcast("hi");
      await settle();

      expect(sender.result.current.broadcast).toBe(broadcast);
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledWith("hi", expect.any(String));
    });

    it("does nothing when broadcasting after unmount", async () => {
      const peer = createPeer("k");
      const { result, unmount } = render("k");
      await settle();
      const { broadcast } = result.current;
      unmount();
      peer.received.length = 0;

      expect(() => broadcast("late")).not.toThrow();
      await settle();
      expect(peer.received).toHaveLength(0);
    });

    it("throws when the message can't be cloned", async () => {
      const { result } = render("k");
      await settle();

      expect(() => result.current.broadcast(() => {})).toThrow();
    });
  });
});
