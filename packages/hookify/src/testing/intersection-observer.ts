import { replaceGlobal } from "./replace-global";

/**
 * Overrides for an entry built by {@link createIntersectionObserverEntry}.
 * Any field of `IntersectionObserverEntry` except `target`.
 */
export type IntersectionObserverEntryInit = Partial<
  Omit<IntersectionObserverEntry, "target">
>;

/**
 * An `IntersectionObserver` created by the fake installed by
 * {@link installIntersectionObserver}, with its state exposed for assertions.
 */
export interface FakeIntersectionObserver {
  /** The callback the observer was created with. */
  readonly callback: IntersectionObserverCallback;
  /** The options the observer was created with, exactly as they were passed. */
  readonly options: IntersectionObserverInit;
  /** The `root` option, or `null` for the viewport. */
  readonly root: Element | Document | null;
  /** The `rootMargin` option. Default is `"0px"`. */
  readonly rootMargin: string;
  /** The `threshold` option as an array. Default is `[0]`. */
  readonly thresholds: readonly number[];
  /** The elements being observed right now, in the order they were added. */
  readonly targets: readonly Element[];
  /**
   * Whether `disconnect()` was called. It becomes `false` again if `observe()`
   * is called afterwards, as the observer is then active once more.
   */
  readonly disconnected: boolean;
  /** Starts observing an element. Observing it twice has no effect. */
  observe(target: Element): void;
  /** Stops observing an element. */
  unobserve(target: Element): void;
  /** Stops observing every element. */
  disconnect(): void;
  /** Always returns an empty list, as the fake never queues entries. */
  takeRecords(): IntersectionObserverEntry[];
  /**
   * Calls the observer's callback with the given entries, as the browser does
   * when visibility changes. Does nothing after `disconnect()`, as in a
   * browser. Wrap it in `act()` if the callback updates React state.
   *
   * @param entries - The entries to deliver, such as ones built with
   * {@link createIntersectionObserverEntry}.
   */
  notify(entries: IntersectionObserverEntry[]): void;
}

/**
 * Returned by {@link installIntersectionObserver}.
 */
export interface IntersectionObserverController {
  /** Every observer created since the fake was installed, oldest first. */
  readonly instances: readonly FakeIntersectionObserver[];
  /** The observers that haven't been disconnected. */
  readonly active: readonly FakeIntersectionObserver[];
  /**
   * Delivers one entry for an element to every active observer that observes
   * it, as the browser does when its visibility changes. Wrap it in `act()` if
   * a callback updates React state.
   *
   * It throws if no active observer observes `target`, because the test would
   * otherwise pass without anything having been notified.
   *
   * @param target - The observed element.
   * @param overrides - Fields of the entry to set. With none, the element is
   * fully visible: `isIntersecting` is `true` and `intersectionRatio` is `1`.
   * @returns The entry that was delivered.
   */
  trigger(
    target: Element,
    overrides?: IntersectionObserverEntryInit
  ): IntersectionObserverEntry;
  /**
   * Puts back the `IntersectionObserver` that was there before the fake was
   * installed, or removes the global if there was none. Calling it more than
   * once does nothing.
   */
  restore(): void;
}

/**
 * Builds a rectangle with every field set to zero, which is what a fake entry
 * reports unless it is overridden.
 *
 * @returns A `DOMRectReadOnly`-shaped object.
 */
const emptyRect = (): DOMRectReadOnly => {
  const rect = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => rect,
  };
  return rect;
};

/**
 * Builds an `IntersectionObserverEntry` for an element.
 *
 * Without overrides it describes a fully visible element. `isIntersecting`
 * and `intersectionRatio` default to values that agree with each other: the
 * ratio is `1` when the element intersects and `0` when it doesn't, and the
 * element intersects when the ratio is above `0`. Rectangles are all zero and
 * `time` is `0` unless overridden.
 *
 * @param target - The element the entry is for.
 * @param overrides - Fields to set. See {@link IntersectionObserverEntryInit}.
 * @returns The entry.
 *
 * @example
 * ```ts
 * const entry = createIntersectionObserverEntry(element, {
 *   intersectionRatio: 0.4,
 * });
 * entry.isIntersecting; // true
 * ```
 */
export const createIntersectionObserverEntry = (
  target: Element,
  overrides: IntersectionObserverEntryInit = {}
): IntersectionObserverEntry => {
  const isIntersecting =
    overrides.isIntersecting ??
    (overrides.intersectionRatio === undefined
      ? true
      : overrides.intersectionRatio > 0);

  return {
    boundingClientRect: emptyRect(),
    intersectionRect: emptyRect(),
    rootBounds: null,
    time: 0,
    intersectionRatio: isIntersecting ? 1 : 0,
    ...overrides,
    isIntersecting,
    target,
  };
};

/**
 * Builds the class that stands in for `IntersectionObserver`, recording every
 * instance it creates.
 *
 * @param instances - The list each new instance adds itself to.
 * @returns The class, to be installed as the global.
 */
const createFakeClass = (instances: FakeIntersectionObserver[]) =>
  class implements FakeIntersectionObserver {
    readonly callback: IntersectionObserverCallback;
    readonly options: IntersectionObserverInit;
    readonly root: Element | Document | null;
    readonly rootMargin: string;
    readonly thresholds: readonly number[];
    targets: Element[] = [];
    disconnected = false;

    constructor(
      callback: IntersectionObserverCallback,
      options: IntersectionObserverInit = {}
    ) {
      this.callback = callback;
      this.options = options;
      this.root = options.root ?? null;
      this.rootMargin = options.rootMargin ?? "0px";
      this.thresholds = Array.isArray(options.threshold)
        ? options.threshold
        : [options.threshold ?? 0];
      instances.push(this);
    }

    observe(target: Element) {
      this.disconnected = false;
      if (!this.targets.includes(target)) {
        this.targets.push(target);
      }
    }

    unobserve(target: Element) {
      this.targets = this.targets.filter((observed) => observed !== target);
    }

    disconnect() {
      this.disconnected = true;
      this.targets = [];
    }

    takeRecords() {
      return [];
    }

    notify(entries: IntersectionObserverEntry[]) {
      if (this.disconnected) return;
      this.callback(entries, this as unknown as IntersectionObserver);
    }
  };

/**
 * Replaces the global `IntersectionObserver` with a fake that you control.
 *
 * jsdom doesn't implement `IntersectionObserver`, so components and hooks that
 * use it can't be tested without one. This fake records every observer that is
 * created, lets you deliver entries with {@link IntersectionObserverController.trigger | trigger}
 * and doesn't depend on any test runner.
 *
 * Call {@link IntersectionObserverController.restore | restore} when the test
 * ends, such as in `afterEach`, so the fake doesn't leak into other tests.
 * Entries are delivered synchronously, so wrap `trigger` in `act()` from your
 * testing library when the callback updates React state.
 *
 * @returns A controller to trigger entries, inspect the observers that were
 * created, and restore the global.
 *
 * @example
 * ```tsx
 * import { act, render, screen } from "@testing-library/react";
 * import { installIntersectionObserver, type IntersectionObserverController } from "@altalyst/hookify/testing";
 *
 * let observers: IntersectionObserverController;
 * beforeEach(() => {
 *   observers = installIntersectionObserver();
 * });
 * afterEach(() => observers.restore());
 *
 * it("loads the image when it scrolls into view", () => {
 *   render(<LazyImage />);
 *
 *   act(() => {
 *     observers.trigger(screen.getByTestId("lazy-image"));
 *   });
 *
 *   expect(screen.getByRole("img")).toBeInTheDocument();
 * });
 * ```
 *
 * @see {@link https://developer.mozilla.org/docs/Web/API/IntersectionObserver | IntersectionObserver on MDN}
 */
export const installIntersectionObserver =
  (): IntersectionObserverController => {
    /** Every observer created while the fake is installed. */
    const instances: FakeIntersectionObserver[] = [];
    const restore = replaceGlobal(
      "IntersectionObserver",
      createFakeClass(instances)
    );

    return {
      instances,
      get active() {
        return instances.filter((observer) => !observer.disconnected);
      },
      trigger(target, overrides) {
        const observers = instances.filter(
          (observer) =>
            !observer.disconnected && observer.targets.includes(target)
        );
        if (observers.length === 0) {
          throw new Error(
            "No active IntersectionObserver is observing this element, so nothing was notified. Render the component first, and check that it observes the element you passed."
          );
        }

        const entry = createIntersectionObserverEntry(target, overrides);
        for (const observer of observers) {
          observer.notify([entry]);
        }
        return entry;
      },
      restore,
    };
  };
