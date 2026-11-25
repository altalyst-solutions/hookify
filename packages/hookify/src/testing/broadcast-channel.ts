import { replaceGlobal } from "./replace-global";

/** A message that a fake `BroadcastChannel` has received. */
export interface ReceivedMessage {
  /** The name of the channel that received it. */
  readonly channel: string;
  /** The message, as a structured clone of what was sent. */
  readonly data: unknown;
}

/** A tab that is not the code under test, created by `BroadcastChannelController.peer`. */
export interface BroadcastPeer {
  /** The name of the channel the peer listens on and posts to. */
  readonly name: string;
  /** Every message the peer has received, oldest first. Clear it with `received.length = 0`. */
  readonly received: unknown[];
  /** Whether the peer has been closed. */
  readonly closed: boolean;
  /**
   * Sends a message to every other open channel with this name, as another tab
   * would. Delivery is asynchronous, so wait for the microtask queue, for
   * example with `await act(async () => {})`.
   *
   * @param data - The message. It is cloned, and throws a `DataCloneError`
   * `DOMException` if it can't be, as in a browser.
   */
  post(data: unknown): void;
  /**
   * Leaves the channel, as when the tab closes. It no longer receives or sends
   * anything. Calling it more than once does nothing.
   */
  close(): void;
}

/** Returned by {@link installBroadcastChannel}. */
export interface BroadcastChannelController {
  /**
   * The names of the channels that are open right now, one entry for each open
   * channel, so a name appears twice if two channels use it.
   */
  readonly open: readonly string[];
  /**
   * Every message that was posted since the fake was installed, by anything
   * that was not a peer, oldest first.
   */
  readonly posted: readonly ReceivedMessage[];
  /**
   * Adds a tab that is not the code under test, which listens on a channel and
   * can post to it. Use it to script what other tabs say and to check what the
   * code under test sends.
   *
   * @param name - The name of the channel.
   * @returns The peer.
   */
  peer(name: string): BroadcastPeer;
  /**
   * Closes every channel, including the peers' ones, and puts back the
   * `BroadcastChannel` that was there before the fake was installed, or removes
   * it if there was none. Calling it more than once does nothing.
   */
  restore(): void;
}

/** The shape that the fake channels share, so a delivery can reach any of them. */
interface Channel {
  /** The channel's name. */
  readonly name: string;
  /** Whether it has been closed. */
  closed: boolean;
  /** Receives a message, if it is open. */
  deliver(data: unknown): void;
}

/**
 * Replaces the global `BroadcastChannel` with a fake that delivers messages
 * between channels in the same test.
 *
 * jsdom has no `BroadcastChannel`, so code that talks to other tabs can't be
 * tested without one. The fake follows the specification where code can tell:
 *
 * - A message reaches every other open channel with the same name, never the
 *   channel that sent it.
 * - Delivery is asynchronous, so wait for the microtask queue after posting,
 *   for example with `await act(async () => {})`, or with fake timers
 *   `await vi.advanceTimersByTimeAsync(0)`.
 * - Messages are structured clones, so a posted object isn't shared with the
 *   receiver, and a value that can't be cloned throws a `DataCloneError`.
 * - A closed channel doesn't receive messages, and posting on it throws an
 *   `InvalidStateError`.
 * - Both `onmessage` and `addEventListener("message", ...)` work.
 *
 * Use {@link BroadcastChannelController.peer | peer} to play the other tabs.
 * The fake doesn't depend on any test runner. Call
 * {@link BroadcastChannelController.restore | restore} when the test ends, such
 * as in `afterEach`, so the fake and its channels don't leak into other tests.
 *
 * @returns A controller to add peers, inspect what is open and what was posted,
 * and restore the global.
 *
 * @example
 * ```tsx
 * import { act, render, screen } from "@testing-library/react";
 * import { installBroadcastChannel } from "@altalyst/hookify/testing";
 *
 * const channels = installBroadcastChannel();
 * afterEach(() => channels.restore());
 *
 * it("shows what another tab broadcasts", async () => {
 *   render(<Notifications />);
 *   const otherTab = channels.peer("notifications");
 *
 *   await act(async () => {
 *     otherTab.post({ text: "Saved" });
 *   });
 *
 *   expect(screen.getByText("Saved")).toBeInTheDocument();
 * });
 * ```
 *
 * @see {@link https://developer.mozilla.org/docs/Web/API/Broadcast_Channel_API | Broadcast Channel API on MDN}
 */
export const installBroadcastChannel = (): BroadcastChannelController => {
  /** Every open channel, whether it belongs to the code under test or to a peer. */
  const open = new Set<Channel>();
  /** What the code under test posted. */
  const posted: ReceivedMessage[] = [];

  /**
   * Sends a message from one channel to the others with the same name.
   *
   * @param from - The channel that sends it.
   * @param data - The message.
   * @returns The structured clone that the receivers get.
   */
  const broadcast = (from: Channel, data: unknown) => {
    if (from.closed) {
      throw new DOMException("The channel is closed.", "InvalidStateError");
    }
    const cloned = structuredClone(data);
    for (const channel of open) {
      if (channel === from || channel.name !== from.name) continue;
      void Promise.resolve().then(() => channel.deliver(cloned));
    }
    return cloned;
  };

  const FakeBroadcastChannel = class implements Channel {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onmessageerror: ((event: MessageEvent) => void) | null = null;
    closed = false;
    private readonly listeners = new Set<EventListenerOrEventListenerObject>();

    readonly name: string;

    constructor(name: string) {
      this.name = String(name);
      open.add(this);
    }

    postMessage(data: unknown) {
      const cloned = broadcast(this, data);
      posted.push({ channel: this.name, data: cloned });
    }

    close() {
      this.closed = true;
      open.delete(this);
    }

    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject
    ) {
      if (type === "message") this.listeners.add(listener);
    }

    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject
    ) {
      if (type === "message") this.listeners.delete(listener);
    }

    dispatchEvent(event: Event) {
      this.deliver((event as MessageEvent).data);
      return true;
    }

    deliver(data: unknown) {
      if (this.closed) return;
      const event = new MessageEvent("message", { data });
      this.onmessage?.(event);
      for (const listener of [...this.listeners]) {
        if (typeof listener === "function") listener.call(this, event);
        else listener.handleEvent(event);
      }
    }
  };

  const restoreGlobal = replaceGlobal("BroadcastChannel", FakeBroadcastChannel);
  /** Whether the fake has been restored. */
  let restored = false;

  return {
    get open() {
      return [...open].map((channel) => channel.name);
    },
    posted,
    peer(name) {
      const received: unknown[] = [];
      const channel: Channel = {
        name,
        closed: false,
        deliver: (data) => {
          if (!channel.closed) received.push(data);
        },
      };
      open.add(channel);

      return {
        name,
        received,
        get closed() {
          return channel.closed;
        },
        post: (data) => {
          broadcast(channel, data);
        },
        close: () => {
          channel.closed = true;
          open.delete(channel);
        },
      };
    },
    restore() {
      if (restored) return;
      restored = true;
      for (const channel of open) channel.closed = true;
      open.clear();
      restoreGlobal();
    },
  };
};
