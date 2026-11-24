import { replaceGlobal } from "./replace-global";

/** Options for {@link installMatchMedia}. */
export interface MatchMediaOptions {
  /**
   * Whether a query matches until {@link MatchMediaController.setMatches | setMatches}
   * sets it. Default is `false`, as in a browser whose viewport matches nothing
   * in particular.
   */
  matches?: boolean;
}

/**
 * A `MediaQueryList` created by the fake installed by {@link installMatchMedia},
 * with its listeners exposed for assertions.
 */
export interface FakeMediaQueryList {
  /** The query this list was created for, exactly as it was passed. */
  readonly media: string;
  /** Whether the query currently matches. It is live, as in a browser. */
  readonly matches: boolean;
  /** The legacy `onchange` handler. It runs after the listeners. */
  onchange: ((event: MediaQueryListEvent) => void) | null;
  /** How many `change` listeners are registered on this list right now. */
  readonly listenerCount: number;
  /**
   * Registers a `change` listener. Other event types are ignored, and adding
   * the same listener twice has no effect.
   */
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void;
  /** Removes a `change` listener. */
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null
  ): void;
  /** The deprecated way to register a `change` listener. */
  addListener(listener: ((event: MediaQueryListEvent) => void) | null): void;
  /** The deprecated way to remove a `change` listener. */
  removeListener(listener: ((event: MediaQueryListEvent) => void) | null): void;
  /**
   * Calls the `change` listeners and `onchange`. Events of any other type are
   * ignored.
   *
   * @returns Always `true`.
   */
  dispatchEvent(event: Event): boolean;
}

/** Returned by {@link installMatchMedia}. */
export interface MatchMediaController {
  /**
   * Every list created by a `window.matchMedia(query)` call since the fake was
   * installed, oldest first. Each call creates a new list, as in a browser.
   */
  readonly instances: readonly FakeMediaQueryList[];
  /**
   * How many `change` listeners have been registered since the fake was
   * installed, on any list. Registering a listener that is already registered
   * doesn't count. Use it to check that a component doesn't subscribe again
   * when it re-renders.
   */
  readonly listenersAdded: number;
  /**
   * How many `change` listeners have been removed since the fake was installed,
   * on any list, including those registered with the `once` option after they
   * ran.
   */
  readonly listenersRemoved: number;
  /**
   * How many `change` listeners are registered right now.
   *
   * @param query - Count only the lists for this query. Without it, count them
   * all.
   * @returns The number of listeners.
   */
  listenerCount(query?: string): number;
  /**
   * Whether a query matches right now.
   *
   * @param query - The query, exactly as the code under test passes it.
   * @returns The value set by {@link MatchMediaController.setMatches | setMatches},
   * or the `matches` option if it was never set.
   */
  getMatches(query: string): boolean;
  /**
   * Sets whether a query matches and, if that changes it, fires a `change`
   * event on every list for that query, as a browser does when the viewport
   * changes. Nothing happens if the query already has this value. Wrap it in
   * `act()` if a listener updates React state.
   *
   * Queries are matched as exact strings, so `(min-width: 600px)` and
   * `(min-width:600px)` are different queries.
   *
   * @param query - The query, exactly as the code under test passes it.
   * @param matches - Whether it matches.
   */
  setMatches(query: string, matches: boolean): void;
  /**
   * Puts back the `matchMedia` that was there before the fake was installed,
   * or removes it if there was none. Calling it more than once does nothing.
   */
  restore(): void;
}

/** A registered `change` listener. */
interface Entry {
  /** The listener, as it was passed. */
  listener: EventListenerOrEventListenerObject;
  /** Whether it was registered with the `once` option. */
  once: boolean;
}

/** How many listeners were added and removed across all lists. */
interface Counts {
  added: number;
  removed: number;
}

/**
 * Builds the class that stands in for `MediaQueryList`.
 *
 * @param read - Returns whether a query matches right now.
 * @param instances - The list each new instance adds itself to.
 * @param counts - Where each instance records the listeners it adds and removes.
 * @returns The class.
 */
const createFakeClass = (
  read: (query: string) => boolean,
  instances: FakeMediaQueryList[],
  counts: Counts
) =>
  class implements FakeMediaQueryList {
    onchange: ((event: MediaQueryListEvent) => void) | null = null;
    private entries: Entry[] = [];

    constructor(readonly media: string) {
      instances.push(this);
    }

    get matches() {
      return read(this.media);
    }

    get listenerCount() {
      return this.entries.length;
    }

    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ) {
      if (
        type !== "change" ||
        !listener ||
        this.entries.some((entry) => entry.listener === listener)
      ) {
        return;
      }
      counts.added++;
      this.entries.push({
        listener,
        once: typeof options === "object" && options !== null && !!options.once,
      });
    }

    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null
    ) {
      if (type !== "change") return;
      const before = this.entries.length;
      this.entries = this.entries.filter(
        (entry) => entry.listener !== listener
      );
      counts.removed += before - this.entries.length;
    }

    addListener(listener: ((event: MediaQueryListEvent) => void) | null) {
      this.addEventListener("change", listener as EventListener | null);
    }

    removeListener(listener: ((event: MediaQueryListEvent) => void) | null) {
      this.removeEventListener("change", listener as EventListener | null);
    }

    dispatchEvent(event: Event) {
      if (event.type !== "change") return true;

      for (const entry of [...this.entries]) {
        if (entry.once) this.removeEventListener("change", entry.listener);
        if (typeof entry.listener === "function") {
          entry.listener.call(this, event);
        } else {
          entry.listener.handleEvent(event);
        }
      }
      this.onchange?.(event as MediaQueryListEvent);
      return true;
    }
  };

/**
 * Replaces `window.matchMedia` with a fake that you control.
 *
 * jsdom doesn't implement `matchMedia`, so components and hooks that use it
 * can't be tested without one. Every query starts with the `matches` option
 * (`false` by default), and {@link MatchMediaController.setMatches | setMatches}
 * changes a query and notifies the listeners on it. Each `matchMedia` call
 * returns a new list, as a browser does, and the controller exposes every list
 * and the number of listeners on it, so a test can check that a component
 * subscribes and cleans up. The lists support both `addEventListener` and the
 * deprecated `addListener`. The fake doesn't depend on any test runner.
 *
 * Call {@link MatchMediaController.restore | restore} when the test ends, such
 * as in `afterEach`, so the fake doesn't leak into other tests. Events fire
 * synchronously, so wrap `setMatches` in `act()` from your testing library when
 * a listener updates React state.
 *
 * @param options - See {@link MatchMediaOptions}.
 * @returns A controller to change queries, inspect the lists that were created
 * and restore the global.
 *
 * @example
 * ```tsx
 * import { act, render, screen } from "@testing-library/react";
 * import { installMatchMedia } from "@altalyst/hookify/testing";
 *
 * const media = installMatchMedia();
 * afterEach(() => media.restore());
 *
 * it("shows the wide layout on large screens", () => {
 *   render(<Layout />);
 *   expect(screen.getByText("Narrow")).toBeInTheDocument();
 *
 *   act(() => {
 *     media.setMatches("(min-width: 1024px)", true);
 *   });
 *
 *   expect(screen.getByText("Wide")).toBeInTheDocument();
 * });
 * ```
 *
 * @see {@link https://developer.mozilla.org/docs/Web/API/Window/matchMedia | matchMedia on MDN}
 */
export const installMatchMedia = (
  options: MatchMediaOptions = {}
): MatchMediaController => {
  const { matches: defaultMatches = false } = options;
  /** The value of every query that was set, by query string. */
  const state = new Map<string, boolean>();
  /** Every list created while the fake is installed. */
  const instances: FakeMediaQueryList[] = [];

  const getMatches = (query: string) => state.get(query) ?? defaultMatches;
  const counts: Counts = { added: 0, removed: 0 };
  const FakeMediaQueryList = createFakeClass(getMatches, instances, counts);

  const restore = replaceGlobal(
    "matchMedia",
    (query: string) => new FakeMediaQueryList(query)
  );

  return {
    instances,
    get listenersAdded() {
      return counts.added;
    },
    get listenersRemoved() {
      return counts.removed;
    },
    listenerCount: (query) =>
      instances
        .filter((list) => query === undefined || list.media === query)
        .reduce((total, list) => total + list.listenerCount, 0),
    getMatches,
    setMatches(query, matches) {
      if (getMatches(query) === matches) return;
      state.set(query, matches);

      for (const list of instances.filter((item) => item.media === query)) {
        list.dispatchEvent(
          Object.assign(new Event("change"), { media: query, matches })
        );
      }
    },
    restore,
  };
};
