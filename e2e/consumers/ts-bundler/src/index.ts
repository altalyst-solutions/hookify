import {
  type UseMediaQueryOptions,
  useMediaQuery,
  useToggleState,
} from "@altalyst/hookify";
import {
  type ClipboardController,
  createMemoryStorage,
  type DocumentVisibilityController,
  dispatchStorageEvent,
  installBroadcastChannel,
  installClipboard,
  installDocumentVisibility,
  installLocalStorage,
  installMatchMedia,
  installResizeObserver,
  installWebLocks,
  type BroadcastChannelController,
  type BroadcastPeer,
  type LockInfo,
  type LockRequestRecord,
  type MatchMediaController,
  type MemoryStorage,
  type ReceivedMessage,
  type ResizeObserverController,
  type StorageController,
  type WebLocksController,
} from "@altalyst/hookify/testing";

export const probe = (): [boolean, boolean] => {
  const options: UseMediaQueryOptions = { defaultValue: false };
  const [on, toggle] = useToggleState(true);
  const matches: boolean = useMediaQuery("(min-width: 1px)", options);
  const toggleFn: () => void = toggle;

  // The declarations must be real types, not `any`.
  // @ts-expect-error The initial state has to be a boolean.
  useToggleState("nope");

  void toggleFn;
  return [on, matches];
};

// The `./testing` subpath must resolve to real types too.
export const testingProbe = (): ResizeObserverController => {
  const observers = installResizeObserver();
  const el = document.createElement("div");
  new ResizeObserver(() => {}).observe(el);

  const entry: ResizeObserverEntry = observers.trigger(el, { width: 10 });
  void entry;

  // @ts-expect-error The target has to be an element.
  observers.trigger("nope");

  return observers;
};

export const mediaProbe = (): MatchMediaController => {
  const media = installMatchMedia({ matches: false });

  media.setMatches("(min-width: 600px)", true);
  const matches: boolean = media.getMatches("(min-width: 600px)");
  const listeners: number = media.listenerCount();
  void matches;
  void listeners;

  // @ts-expect-error `matches` has to be a boolean.
  media.setMatches("(min-width: 600px)", "yes");

  return media;
};

export const visibilityProbe = (): DocumentVisibilityController => {
  const visibility = installDocumentVisibility({ visibilityState: "hidden" });

  visibility.setVisibility("visible");
  const hidden: boolean = visibility.hidden;
  void hidden;

  // @ts-expect-error Only real visibility states are accepted.
  visibility.setVisibility("sleeping");

  return visibility;
};

export const storageProbe = (): [MemoryStorage, StorageController] => {
  const storage = createMemoryStorage({ items: { a: "1" }, quota: 100 });
  const items: Record<string, string> = storage.snapshot();
  const local = installLocalStorage({ storage, blocked: false });
  void items;

  dispatchStorageEvent("a", "2", storage);
  dispatchStorageEvent(null, null);

  // @ts-expect-error The new value has to be a string or null.
  dispatchStorageEvent("a", 2, storage);

  return [storage, local];
};

export const clipboardProbe = async (): Promise<ClipboardController> => {
  const clipboard = installClipboard({ text: "start" });

  clipboard.setPermission("denied");
  clipboard.failNext("nope");
  clipboard.deferNext();
  const text: string = clipboard.text;
  const writes: readonly string[] = clipboard.writes;
  clipboard.pending[0]?.resolve();
  void text;
  void writes;

  // @ts-expect-error Only granted or denied are accepted.
  clipboard.setPermission("maybe");

  await navigator.clipboard.writeText("x");
  return clipboard;
};

export const locksProbe = async (): Promise<WebLocksController> => {
  const locks = installWebLocks();

  const other = locks.hold("job", "shared");
  await other.granted;
  other.release();
  locks.failNext(new Error("nope"));
  locks.releaseAll("job");
  const held: readonly LockInfo[] = locks.held;
  const pending: readonly LockInfo[] = locks.pending;
  const requests: readonly LockRequestRecord[] = locks.requests;
  void held;
  void pending;
  void requests;

  // @ts-expect-error Only shared or exclusive are accepted.
  locks.hold("job", "mixed");

  return locks;
};

export const broadcastChannelProbe = (): BroadcastChannelController => {
  const channels = installBroadcastChannel();

  const peer: BroadcastPeer = channels.peer("room");
  peer.post({ hello: 1 });
  const received: unknown[] = peer.received;
  const closed: boolean = peer.closed;
  const open: readonly string[] = channels.open;
  const posted: readonly ReceivedMessage[] = channels.posted;
  void received;
  void closed;
  void open;
  void posted;
  peer.close();

  return channels;
};
