import { useCallback, useEffect, useRef, useState } from "react";

import { useLatest } from "./use-latest";

/** Prefix of the lock and channel names, so they can't clash with the consumer's own. */
const NAME_PREFIX = "hookify:tab-leader:";

/** How often the heartbeat fallback pings the other tabs, in milliseconds. */
const HEARTBEAT_MS = 1000;
/** How long the heartbeat fallback waits without a ping before dropping a tab, in milliseconds. */
const PEER_TIMEOUT_MS = 3000;
/**
 * How long a tab in the heartbeat fallback waits for the other tabs to answer
 * before electing, in milliseconds.
 */
const DISCOVERY_MS = 400;

/** Options for {@link useTabLeader}. */
export interface UseTabLeaderOptions<TMessage = unknown> {
  /**
   * Takes part in the election only while `true`. Set it to `false` to step
   * down, for example while the user is signed out. Default is `true`.
   */
  enabled?: boolean;
  /** Called when this hook instance becomes the leader. */
  onElected?: () => void;
  /**
   * Called when this hook instance stops being the leader: when another
   * instance takes over, `key` or `enabled` changes, or the component
   * unmounts. Use it to stop the work started in `onElected`.
   */
  onDemoted?: () => void;
  /**
   * Called when another tab (or another hook instance in this tab) calls
   * {@link UseTabLeaderReturn.broadcast | broadcast}. It never receives the
   * hook's own messages.
   *
   * @param message - The value passed to `broadcast`.
   * @param senderId - The {@link UseTabLeaderReturn.id | id} of the sender.
   */
  onMessage?: (message: TMessage, senderId: string) => void;
}

/** Value returned by {@link useTabLeader}. */
export interface UseTabLeaderReturn<TMessage = unknown> {
  /**
   * `true` while this hook instance is the leader. It is `false` during server
   * rendering and on the first render, until the election has run.
   */
  isLeader: boolean;
  /**
   * The {@link id} of the current leader, or `null` while it is not known: no
   * leader has been elected yet, or this tab can't learn who the leader is
   * because `BroadcastChannel` is missing.
   */
  leaderId: string | null;
  /**
   * A random id for this hook instance, or `null` until the effect has run
   * (and while `enabled` is `false`). Every instance gets its own id, also
   * when several share a tab. It changes when `key` changes.
   */
  id: string | null;
  /**
   * Sends `message` to every other tab (and hook instance) using the same
   * `key`, which receive it in `onMessage`. It is how the leader hands its
   * results to the followers. The value must be structured-cloneable, or this
   * throws. It does nothing without `BroadcastChannel`. Stable identity.
   */
  broadcast: (message: TMessage) => void;
}

/**
 * A message of the election protocol, sent between the tabs of one `key`.
 *
 * - `hello`: a tab joined and asks the others to introduce themselves.
 * - `leader`: the Web Locks leader announces itself.
 * - `ping`: a heartbeat fallback tab announces it is alive, and since when.
 * - `bye`: a heartbeat fallback tab leaves.
 */
type ProtocolMessage =
  | { type: "hello" }
  | { type: "leader"; id: string }
  | { type: "ping"; id: string; since: number }
  | { type: "bye"; id: string };

/** The envelope around a value passed to `broadcast`, which sets it apart from protocol messages. */
interface UserMessage {
  /** Marks the envelope as a consumer message. */
  type: "message";
  /** The id of the sending hook instance. */
  from: string;
  /** The value passed to `broadcast`. */
  data: unknown;
}

/** An election mechanism that is running for one hook instance. */
interface Engine {
  /** Handles a protocol message received from another tab. */
  receive: (message: ProtocolMessage) => void;
  /** Stops the mechanism and gives up leadership. */
  stop: () => void;
}

/** What the hook gives an election mechanism to work with. */
interface EngineContext {
  /** The id of this hook instance. */
  id: string;
  /** Sends a protocol message to the other tabs, or does nothing without `BroadcastChannel`. */
  post: (message: ProtocolMessage) => void;
  /** Reports who the leader is. Passing this instance's `id` makes it the leader. */
  setLeader: (leaderId: string) => void;
}

/** The state kept by {@link useTabLeader}, tagged with the `key` it belongs to. */
interface State {
  /** The `key` the election ran for, or `null` before it started. */
  key: string | null;
  /** The id of this hook instance. */
  id: string | null;
  /** The id of the current leader, if known. */
  leaderId: string | null;
}

/** The state before an election has started, or while the hook is disabled. */
const IDLE_STATE: State = { key: null, id: null, leaderId: null };

/**
 * Creates a random id for a hook instance. Falls back to a timestamp and
 * random string where `crypto.randomUUID` is missing, as in insecure contexts.
 *
 * @returns A new id, unique across tabs for all practical purposes.
 */
const createId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/**
 * Calls a consumer callback. Errors it throws are rethrown asynchronously, so
 * they are reported without breaking the election that called it.
 *
 * @param callback - The callback to call, if any.
 */
const callSafely = (callback: (() => void) | undefined) => {
  try {
    callback?.();
  } catch (error) {
    setTimeout(() => {
      throw error;
    });
  }
};

/**
 * Opens a `BroadcastChannel`.
 *
 * @param name - The channel name.
 * @returns The channel, or `null` when `BroadcastChannel` is missing or can't
 * be created, for example in a sandboxed iframe.
 */
const createChannel = (name: string): BroadcastChannel | null => {
  try {
    return typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(name);
  } catch {
    return null;
  }
};

/**
 * Primary election mechanism: whoever holds the Web Lock is the leader. The
 * browser hands the lock to the next waiting tab when the holder closes or
 * crashes. The leader announces itself over the channel so followers can learn
 * its id.
 *
 * @param locks - The `navigator.locks` manager.
 * @param name - The lock name.
 * @param context - The {@link EngineContext | context} of the hook instance.
 * @returns The running {@link Engine}.
 */
const electWithLocks = (
  locks: LockManager,
  name: string,
  context: EngineContext
): Engine => {
  const { id, post, setLeader } = context;
  /** Cancels the lock request while it is still waiting. */
  const abort = new AbortController();
  /** Resolves the promise that keeps the lock held. Set once leading. */
  let release: (() => void) | undefined;
  /** `true` once this instance holds the lock. */
  let isHolder = false;

  locks
    .request(name, { signal: abort.signal }, () => {
      if (abort.signal.aborted) return;
      isHolder = true;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      setLeader(id);
      post({ type: "leader", id });
      return held;
    })
    .catch(() => {
      // An abort is our own cleanup. Any other failure means the lock can't be
      // used (for example in a sandboxed iframe, which has no other tabs to
      // compete with), so lead alone.
      if (!abort.signal.aborted) setLeader(id);
    });

  post({ type: "hello" });

  return {
    receive: (message) => {
      if (isHolder) {
        if (message.type === "hello") post({ type: "leader", id });
      } else if (message.type === "leader") {
        setLeader(message.id);
      }
    },
    stop: () => {
      abort.abort();
      release?.();
    },
  };
};

/**
 * Fallback election mechanism for browsers without Web Locks: tabs ping each
 * other and the tab that has been around the longest is the leader, with ties
 * broken by id. A tab that stops pinging is dropped after a timeout, or right
 * away when it says goodbye.
 *
 * @param context - The {@link EngineContext | context} of the hook instance.
 * @returns The running {@link Engine}.
 */
const electWithHeartbeat = (context: EngineContext): Engine => {
  const { id, post, setLeader } = context;
  /** When this instance joined, which decides who is the oldest tab. */
  const since = Date.now();
  /** The other tabs seen recently, with when they joined and were last heard. */
  const peers = new Map<string, { since: number; seenAt: number }>();
  /** `true` once the discovery delay has passed and electing is allowed. */
  let isReady = false;

  /** Drops expired tabs, picks the oldest of the rest and reports it. */
  const elect = () => {
    if (!isReady) return;
    const now = Date.now();
    let leader = { id, since };
    for (const [peerId, peer] of peers) {
      if (now - peer.seenAt > PEER_TIMEOUT_MS) {
        peers.delete(peerId);
      } else if (
        peer.since < leader.since ||
        (peer.since === leader.since && peerId < leader.id)
      ) {
        leader = { id: peerId, since: peer.since };
      }
    }
    setLeader(leader.id);
  };

  /** Tells the other tabs this one is alive. */
  const ping = () => post({ type: "ping", id, since });

  // Wait for the other tabs to answer before electing, so a newcomer doesn't
  // briefly think it's the leader.
  const discovery = setTimeout(() => {
    isReady = true;
    elect();
  }, DISCOVERY_MS);
  const heartbeat = setInterval(() => {
    ping();
    elect();
  }, HEARTBEAT_MS);

  post({ type: "hello" });
  ping();

  return {
    receive: (message) => {
      if (message.type === "hello") {
        ping();
      } else if (message.type === "ping") {
        peers.set(message.id, { since: message.since, seenAt: Date.now() });
        elect();
      } else if (message.type === "bye") {
        peers.delete(message.id);
        elect();
      }
    },
    stop: () => {
      clearTimeout(discovery);
      clearInterval(heartbeat);
      post({ type: "bye", id });
    },
  };
};

/**
 * Elects one tab as the leader among all tabs of the same origin that use the
 * same `key`, so work that should run only once (polling, a websocket, a
 * sync) runs in a single tab. When the leader closes or crashes, another tab
 * is elected automatically.
 *
 * `isLeader` updates reactively, and `onElected` and `onDemoted` fire on the
 * transitions. Different keys elect their leaders independently. Leadership
 * is released when the component unmounts, `key` changes or `enabled` becomes
 * `false`, and `onDemoted` is called if the instance was the leader.
 *
 * The election uses the Web Locks API, so a leader that crashes or is
 * frozen is replaced reliably. Without it, tabs fall back to a
 * `BroadcastChannel` heartbeat: the oldest tab leads, and a tab that stops
 * pinging for a few seconds is dropped. That fallback is best effort, since
 * browsers may slow the timers of hidden tabs. If neither API exists (server
 * rendering, an old browser, an insecure context), there is nothing to
 * compete with, so the hook treats the page as a single tab and makes it the
 * leader once the effect has run. During server rendering, `isLeader` is
 * `false`.
 *
 * `broadcast` and `onMessage` give the leader a way to share what it fetched
 * with the other tabs over the same channel.
 *
 * @typeParam TMessage - The type of the messages passed to `broadcast`.
 * @param key - Names the election. Tabs with the same `key` compete, tabs
 * with different keys don't.
 * @param options - Optional {@link UseTabLeaderOptions | settings and callbacks}.
 * @returns The `isLeader`, `leaderId` and `id` state and the `broadcast`
 * function.
 *
 * @example
 * ```tsx
 * // Only the leader tab polls
 * const { isLeader } = useTabLeader("notifications");
 *
 * useInterval(poll, isLeader ? 5000 : null);
 * ```
 *
 * @example
 * ```tsx
 * // The leader fetches, every tab shows the result
 * const [data, setData] = useState<Data>();
 * const { broadcast } = useTabLeader<Data>("prices", {
 *   onElected: () => startPolling(),
 *   onDemoted: () => stopPolling(),
 *   onMessage: setData,
 * });
 *
 * const onPoll = (next: Data) => {
 *   setData(next);
 *   broadcast(next);
 * };
 * ```
 *
 * For a live, editable example, see the [useTabLeader docs page](https://altalyst-solutions.github.io/hookify/hooks/use-tab-leader).
 */
export const useTabLeader = <TMessage = unknown>(
  key: string,
  options?: UseTabLeaderOptions<TMessage>
): UseTabLeaderReturn<TMessage> => {
  const enabled = options?.enabled ?? true;

  /** The election state, tagged with the `key` it was produced for. */
  const [state, setState] = useState<State>(IDLE_STATE);

  /** Refs to the latest callbacks, so changing them never re-runs the election. */
  const onElectedRef = useLatest(options?.onElected);
  const onDemotedRef = useLatest(options?.onDemoted);
  const onMessageRef = useLatest(options?.onMessage);

  /** The id and channel of the running election, used by `broadcast`. */
  const sessionRef = useRef<{ id: string; channel: BroadcastChannel } | null>(
    null
  );

  useEffect(() => {
    if (!enabled) return;

    const id = createId();
    const name = NAME_PREFIX + key;
    const channel = createChannel(name);
    /** The leader as last reported by the election, if known. */
    let leaderId: string | null = null;
    /** `false` once this effect has been cleaned up, so late reports are ignored. */
    let isActive = true;

    /** Copies the election result into React state. */
    const publish = () => setState({ key, id, leaderId });
    /** Calls the latest `onElected`. */
    const notifyElected = () => callSafely(onElectedRef.current);
    /** Calls the latest `onDemoted`. */
    const notifyDemoted = () => callSafely(onDemotedRef.current);

    publish();
    sessionRef.current = channel ? { id, channel } : null;

    /** Records a new leader, updates state and fires `onElected` or `onDemoted` on a change of role. */
    const setLeader = (next: string) => {
      if (!isActive || next === leaderId) return;
      const wasLeader = leaderId === id;
      leaderId = next;
      publish();
      if (!wasLeader && next === id) notifyElected();
      else if (wasLeader && next !== id) notifyDemoted();
    };

    /** What the election mechanisms use to talk to the other tabs and report back. */
    const context: EngineContext = {
      id,
      post: (message) => channel?.postMessage(message),
      setLeader,
    };
    // Web Locks first, then the heartbeat over the channel. With neither, the
    // page is the only tab there is, so it leads.
    const locks =
      typeof navigator === "undefined" ? undefined : navigator.locks;
    const engine: Engine = locks
      ? electWithLocks(locks, name, context)
      : channel
        ? electWithHeartbeat(context)
        : { receive: () => {}, stop: () => {} };
    if (!locks && !channel) setLeader(id);

    if (channel) {
      channel.onmessage = (
        event: MessageEvent<ProtocolMessage | UserMessage>
      ) => {
        const message = event.data;
        if (typeof message !== "object" || message === null) return;
        if (message.type === "message") {
          onMessageRef.current?.(message.data as TMessage, message.from);
        } else {
          engine.receive(message);
        }
      };
    }

    return () => {
      const wasLeader = leaderId === id;
      isActive = false;
      engine.stop();
      channel?.close();
      sessionRef.current = null;
      if (wasLeader) notifyDemoted();
    };
  }, [key, enabled, onElectedRef, onDemotedRef, onMessageRef]);

  /** Sends `message` to the other tabs with the same `key`. */
  const broadcast = useCallback((message: TMessage) => {
    const session = sessionRef.current;
    if (!session) return;
    const envelope: UserMessage = {
      type: "message",
      from: session.id,
      data: message,
    };
    session.channel.postMessage(envelope);
  }, []);

  /** Ignores state from another `key`, or from before the hook was disabled. */
  const current = enabled && state.key === key ? state : IDLE_STATE;

  return {
    isLeader: current.id !== null && current.leaderId === current.id,
    leaderId: current.leaderId,
    id: current.id,
    broadcast,
  };
};
