---
title: Testing
description: Test components that use Hookify hooks in jsdom with fakes for IntersectionObserver, ResizeObserver, matchMedia, storage, the clipboard, Web Locks and BroadcastChannel.
slug: /testing
---

# Testing components that use Hookify

Many hooks rely on browser APIs that jsdom, the DOM that Vitest and Jest use,
doesn't implement: `IntersectionObserver`, `ResizeObserver`, `matchMedia`, the
clipboard, Web Locks and, in some environments, `BroadcastChannel`. Without
them, a component that uses `useIntersectionObserver` or `useClipboard` can't be
rendered in a test, and writing the missing pieces by hand is easy to get
wrong.

`@altalyst/hookify/testing` ships ready-made fakes. Each `installX()` puts a
fake on the global, returns a controller that drives it, and has a `restore()`
that puts back what was there before.

- It is a separate entry. Your production bundle never includes it, because
  `@altalyst/hookify` doesn't import it.
- It doesn't depend on a test runner or on React, so it works with Vitest,
  Jest or anything else that gives you a DOM.
- It is typed, and the fakes follow the real APIs closely: the same errors, the
  same queueing and ordering rules, and events that fire when a browser would
  fire them.

## Set up

There is nothing to install beyond Hookify itself. Import the fakes in your test
files, install them before each test, and restore them after it:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, it } from "vitest";
import {
  installIntersectionObserver,
  type IntersectionObserverController,
} from "@altalyst/hookify/testing";

let observers: IntersectionObserverController;

beforeEach(() => {
  observers = installIntersectionObserver();
});

afterEach(() => {
  observers.restore();
});
```

Installing in `beforeEach` and restoring in `afterEach` gives every test a fresh
fake with nothing left over from the last one. In Jest, `beforeEach`, `afterEach`
and `it` are globals, so leave out the first import.

- **Vitest:** use the `jsdom` environment (`test.environment`).
- **Jest:** use `jest-environment-jsdom`, and Jest 28 or later, which resolves
  the `@altalyst/hookify/testing` subpath through the package's `exports`.
- **TypeScript:** `moduleResolution` set to `node16`, `nodenext` or `bundler`
  works as usual, and `node10` is supported too.

The examples below assume each fake was installed like this, in a variable named
after it (`observers`, `resizes`, `media`, `visibility`, `local`, `clipboard`,
`locks` and `channels`).

Every call that makes the code under test update React state needs to be
wrapped in `act()`, because the fakes fire events as a browser would:

```tsx
act(() => {
  observers.trigger(screen.getByTestId("lazy-image"));
});
```

## Which fake for which hook

| Hook                                                                                               | Fakes to use                                                                                                               |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [`useIntersectionObserver`](/hooks/use-intersection-observer), [`useIsStuck`](/hooks/use-is-stuck) | [`installIntersectionObserver`](#intersectionobserver-and-resizeobserver)                                                  |
| [`useImpression`](/hooks/use-impression)                                                           | [`installIntersectionObserver`](#intersectionobserver-and-resizeobserver), [`installDocumentVisibility`](#page-visibility) |
| [`useResizeObserver`](/hooks/use-resize-observer), [`useElementSize`](/hooks/use-element-size)     | [`installResizeObserver`](#intersectionobserver-and-resizeobserver)                                                        |
| [`useMediaQuery`](/hooks/use-media-query)                                                          | [`installMatchMedia`](#matchmedia)                                                                                         |
| [`useDocVisible`](/hooks/use-doc-visible), [`useNow`](/hooks/use-now)                              | [`installDocumentVisibility`](#page-visibility)                                                                            |
| [`usePersistedState`](/hooks/use-persisted-state), [`useFrecency`](/hooks/use-frecency)            | [`createMemoryStorage`, `installLocalStorage`, `installSessionStorage`, `dispatchStorageEvent`](#web-storage)              |
| [`useClipboard`](/hooks/use-clipboard)                                                             | [`installClipboard`](#clipboard)                                                                                           |
| [`useWebLock`](/hooks/use-web-lock)                                                                | [`installWebLocks`](#web-locks)                                                                                            |
| [`useTabLeader`](/hooks/use-tab-leader)                                                            | [`installWebLocks`](#web-locks), [`installBroadcastChannel`](#broadcastchannel)                                            |

## IntersectionObserver and ResizeObserver

`installIntersectionObserver()` and `installResizeObserver()` replace the global
constructors. The controller's `trigger(target, overrides)` delivers an entry to
every observer that is watching `target`, and `instances` and `active` list the
observers the code under test created.

```tsx
it("loads the image when it scrolls into view", () => {
  render(<LazyImage />);

  act(() => {
    observers.trigger(screen.getByTestId("lazy-image"), {
      intersectionRatio: 0.4,
    });
  });

  expect(screen.getByRole("img")).toBeInTheDocument();
});
```

For a resize observer, pass the size instead:

```tsx
act(() => {
  resizes.trigger(screen.getByTestId("box"), { width: 320, height: 200 });
});
```

`createIntersectionObserverEntry()` and `createResizeObserverEntry()` build
entries on their own, for tests of code that takes an entry as an argument.

## matchMedia

`installMatchMedia({ matches })` replaces `window.matchMedia`. A query matches
`matches` (`false` by default) until you change it with `setMatches`, which fires
`change` on every list for that query, as resizing the window does:

```tsx
it("shows the wide layout on large screens", () => {
  render(<Layout />);
  expect(screen.getByText("Narrow")).toBeInTheDocument();

  act(() => {
    media.setMatches("(min-width: 1024px)", true);
  });

  expect(screen.getByText("Wide")).toBeInTheDocument();
});
```

Queries are compared as exact strings, so pass the same text your component
uses. `listenersAdded`, `listenersRemoved` and `listenerCount()` let a test check
that a component subscribes once and cleans up.

## Page visibility

`installDocumentVisibility({ visibilityState })` controls
`document.visibilityState` and `document.hidden`. `setVisibility("hidden")`
fires `visibilitychange`, as switching tabs does:

```tsx
it("pauses the clock while the tab is hidden", () => {
  render(<Clock />);

  act(() => {
    visibility.setVisibility("hidden");
  });

  expect(screen.getByText("Paused")).toBeInTheDocument();
});
```

## Web storage

`createMemoryStorage({ items, quota })` is an in-memory `Storage`. A `quota`
counts characters and makes writes past it throw a real `QuotaExceededError`,
and `0` makes every write fail. `installLocalStorage()` and
`installSessionStorage()` put one on the window, and `blocked: true` makes the
global throw a `SecurityError`, as browsers do when storage is disabled.

```tsx
it("starts from the saved theme", () => {
  local.storage.setItem("theme", JSON.stringify("dark"));

  render(<ThemeSwitcher />);

  expect(screen.getByText("dark")).toBeInTheDocument();
});
```

To test syncing between tabs, `dispatchStorageEvent(key, newValue, storage)`
changes the storage and fires the `storage` event, as another tab's write does:

```tsx
it("follows changes made in another tab", () => {
  render(<ThemeSwitcher />);

  act(() => {
    dispatchStorageEvent("theme", JSON.stringify("dark"), local.storage);
  });

  expect(screen.getByText("dark")).toBeInTheDocument();
});
```

## Clipboard

`installClipboard({ text })` replaces `navigator.clipboard`. It records `writes`,
keeps the current `text` and counts `reads`:

```tsx
it("copies the invite link", async () => {
  render(<InviteLink url="https://example.com/join" />);

  await userEvent.click(screen.getByRole("button", { name: "Copy" }));

  expect(clipboard.text).toBe("https://example.com/join");
});
```

To test failures, `setPermission("denied")` makes calls reject with a
`NotAllowedError`, and `failNext(error)` fails the next call only. `deferNext()`
holds a call in flight, so you can test what happens while a copy is pending and
settle it through `clipboard.pending[0].resolve()` or `.reject()`.

## Web Locks

`installWebLocks()` replaces `navigator.locks` with an in-memory lock manager
that follows the real rules: requests are granted in order for each name,
shared locks run together, and `ifAvailable`, `steal` and an abort `signal` work.
The controller's `hold(name, mode)` takes a lock the way another tab would and
returns a `release()`:

```tsx
it("waits while another tab holds the lock", async () => {
  const otherTab = locks.hold("sync");
  render(<SyncButton />);

  await act(async () => {});
  expect(screen.getByText("Waiting for another tab")).toBeInTheDocument();

  await act(async () => {
    otherTab.release();
  });
  expect(screen.getByText("Syncing")).toBeInTheDocument();
});
```

`held`, `pending` and `requests` show what the code under test did, and
`failNext(error)` makes the next request reject. Locks are granted on a later
microtask, as in a browser, so wrap the code in `await act(async () => {})`.

## BroadcastChannel

`installBroadcastChannel()` replaces `BroadcastChannel`. Messages are copied with
the structured clone algorithm and delivered, asynchronously, to the other open
channels with the same name, never back to the sender. `peer(name)` is a
stand-in for another tab: it can `post()` messages, and it records what it
`received`.

```tsx
it("shows what another tab broadcasts", async () => {
  render(<Notifications />);
  const otherTab = channels.peer("notifications");

  await act(async () => {
    otherTab.post({ text: "Saved" });
  });

  expect(screen.getByText("Saved")).toBeInTheDocument();
});
```

`useTabLeader` uses both a lock and a channel, so install both to test who
becomes the leader, and use `locks.hold()` and `channels.peer()` to play the
other tabs.

## Server rendering

`renderToString` from `react-dom/server` runs the render but not effects, so it
shows what a hook does before any browser API is read. Install a fake and check
that nothing used it:

```tsx
import { renderToString } from "react-dom/server";

it("renders on the server without observing anything", () => {
  const html = renderToString(<LazyImage />);

  expect(html).toContain("placeholder");
  expect(observers.instances).toHaveLength(0);
});
```

To run a test file without `window` at all, so that hooks take their server
path, put `// @vitest-environment node` (Vitest) or
`/** @jest-environment node */` (Jest) at the top of the file. Don't install
fakes there: they replace globals on the window or navigator.

## Test your own components, not Hookify

Hookify's own tests use these fakes, so they match the behavior the hooks need.
Test what your component shows and does, and let the fake play the browser.
Don't assert on how many times a hook ran or what a fake was called with unless
that is the behavior you care about.
