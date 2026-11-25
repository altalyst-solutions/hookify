import { replaceGlobal } from "./replace-global";

/** What a fake `ResizeObserver` was asked to observe. */
export interface ResizeObserverObservation {
  /** The observed element. */
  readonly target: Element;
  /** The options passed to `observe()`. `{}` if none were. */
  readonly options: ResizeObserverOptions;
}

/**
 * Describes an entry built by {@link createResizeObserverEntry}.
 */
export interface ResizeObserverEntryInit {
  /** The content box width, in CSS pixels. Default is `0`. */
  width?: number;
  /** The content box height, in CSS pixels. Default is `0`. */
  height?: number;
  /**
   * The border box size. By default it equals the content box. Pass `null` to
   * leave `borderBoxSize` out, as browsers before Safari 15.4 do, so code that
   * falls back to `getBoundingClientRect()` can be tested.
   */
  borderBox?: { inlineSize: number; blockSize: number } | null;
}

/**
 * A `ResizeObserver` created by the fake installed by
 * {@link installResizeObserver}, with its state exposed for assertions.
 */
export interface FakeResizeObserver {
  /** The callback the observer was created with. */
  readonly callback: ResizeObserverCallback;
  /**
   * What the observer observes right now, in the order it was added. Each
   * entry has the options its `observe()` call received, such as `box`.
   */
  readonly observations: readonly ResizeObserverObservation[];
  /** The elements being observed right now. */
  readonly targets: readonly Element[];
  /**
   * Whether `disconnect()` was called. It becomes `false` again if `observe()`
   * is called afterwards, as the observer is then active once more.
   */
  readonly disconnected: boolean;
  /**
   * Starts observing an element. Observing an element that is already observed
   * replaces its options, as in a browser.
   */
  observe(target: Element, options?: ResizeObserverOptions): void;
  /** Stops observing an element. */
  unobserve(target: Element): void;
  /** Stops observing every element. */
  disconnect(): void;
  /**
   * Calls the observer's callback with the given entries, as the browser does
   * when an element is resized. Does nothing after `disconnect()`, as in a
   * browser. Wrap it in `act()` if the callback updates React state.
   *
   * @param entries - The entries to deliver, such as ones built with
   * {@link createResizeObserverEntry}.
   */
  notify(entries: ResizeObserverEntry[]): void;
}

/**
 * Returned by {@link installResizeObserver}.
 */
export interface ResizeObserverController {
  /** Every observer created since the fake was installed, oldest first. */
  readonly instances: readonly FakeResizeObserver[];
  /** The observers that haven't been disconnected. */
  readonly active: readonly FakeResizeObserver[];
  /**
   * Delivers one entry for an element to every active observer that observes
   * it, as the browser does when it is resized. Wrap it in `act()` if a
   * callback updates React state.
   *
   * It throws if no active observer observes `target`, because the test would
   * otherwise pass without anything having been notified.
   *
   * @param target - The observed element.
   * @param size - The size to report. See {@link ResizeObserverEntryInit}.
   * @returns The entry that was delivered.
   */
  trigger(target: Element, size?: ResizeObserverEntryInit): ResizeObserverEntry;
  /**
   * Puts back the `ResizeObserver` that was there before the fake was
   * installed, or removes the global if there was none. Calling it more than
   * once does nothing.
   */
  restore(): void;
}

/**
 * Builds a `DOMRectReadOnly`-shaped rectangle at the origin.
 *
 * @param width - The rectangle's width.
 * @param height - The rectangle's height.
 * @returns The rectangle.
 */
const rectOf = (width: number, height: number): DOMRectReadOnly => {
  const rect = {
    x: 0,
    y: 0,
    width,
    height,
    top: 0,
    right: width,
    bottom: height,
    left: 0,
    toJSON: () => rect,
  };
  return rect;
};

/**
 * Builds a `ResizeObserverEntry` for an element.
 *
 * `contentRect` and `contentBoxSize` report the given width and height, and
 * `borderBoxSize` reports `borderBox`, or the same size if it isn't given.
 * `devicePixelContentBoxSize` is empty, as it is in browsers that don't
 * support it.
 *
 * @param target - The element the entry is for.
 * @param size - The size to report. See {@link ResizeObserverEntryInit}.
 * @returns The entry.
 *
 * @example
 * ```ts
 * const entry = createResizeObserverEntry(element, { width: 300, height: 200 });
 * entry.contentRect.width; // 300
 * ```
 */
export const createResizeObserverEntry = (
  target: Element,
  size: ResizeObserverEntryInit = {}
): ResizeObserverEntry => {
  const { width = 0, height = 0, borderBox } = size;
  const content = { inlineSize: width, blockSize: height };
  const border = borderBox === undefined ? content : borderBox;

  return {
    target,
    contentRect: rectOf(width, height),
    contentBoxSize: [content],
    // `undefined` stands for browsers that don't report a border box.
    borderBoxSize: border === null ? undefined : [border],
    devicePixelContentBoxSize: [],
  } as unknown as ResizeObserverEntry;
};

/**
 * Builds the class that stands in for `ResizeObserver`, recording every
 * instance it creates.
 *
 * @param instances - The list each new instance adds itself to.
 * @returns The class, to be installed as the global.
 */
const createFakeClass = (instances: FakeResizeObserver[]) =>
  class implements FakeResizeObserver {
    readonly callback: ResizeObserverCallback;
    observations: ResizeObserverObservation[] = [];
    disconnected = false;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      instances.push(this);
    }

    get targets() {
      return this.observations.map(({ target }) => target);
    }

    observe(target: Element, options: ResizeObserverOptions = {}) {
      this.disconnected = false;
      this.observations = [
        ...this.observations.filter(
          (observation) => observation.target !== target
        ),
        { target, options },
      ];
    }

    unobserve(target: Element) {
      this.observations = this.observations.filter(
        (observation) => observation.target !== target
      );
    }

    disconnect() {
      this.disconnected = true;
      this.observations = [];
    }

    notify(entries: ResizeObserverEntry[]) {
      if (this.disconnected) return;
      this.callback(entries, this as unknown as ResizeObserver);
    }
  };

/**
 * Replaces the global `ResizeObserver` with a fake that you control.
 *
 * jsdom doesn't implement `ResizeObserver`, so components and hooks that use
 * it can't be tested without one. This fake records every observer that is
 * created, lets you deliver sizes with {@link ResizeObserverController.trigger | trigger}
 * and doesn't depend on any test runner.
 *
 * Call {@link ResizeObserverController.restore | restore} when the test ends,
 * such as in `afterEach`, so the fake doesn't leak into other tests. Entries
 * are delivered synchronously, so wrap `trigger` in `act()` from your testing
 * library when the callback updates React state.
 *
 * @returns A controller to trigger entries, inspect the observers that were
 * created, and restore the global.
 *
 * @example
 * ```tsx
 * import { act, render, screen } from "@testing-library/react";
 * import { installResizeObserver, type ResizeObserverController } from "@altalyst/hookify/testing";
 *
 * let observers: ResizeObserverController;
 * beforeEach(() => {
 *   observers = installResizeObserver();
 * });
 * afterEach(() => observers.restore());
 *
 * it("shows the width of the box", () => {
 *   render(<MeasuredBox />);
 *
 *   act(() => {
 *     observers.trigger(screen.getByTestId("box"), { width: 320, height: 200 });
 *   });
 *
 *   expect(screen.getByText("320px")).toBeInTheDocument();
 * });
 * ```
 *
 * @see {@link https://developer.mozilla.org/docs/Web/API/ResizeObserver | ResizeObserver on MDN}
 */
export const installResizeObserver = (): ResizeObserverController => {
  /** Every observer created while the fake is installed. */
  const instances: FakeResizeObserver[] = [];
  const restore = replaceGlobal("ResizeObserver", createFakeClass(instances));

  return {
    instances,
    get active() {
      return instances.filter((observer) => !observer.disconnected);
    },
    trigger(target, size) {
      const observers = instances.filter(
        (observer) =>
          !observer.disconnected && observer.targets.includes(target)
      );
      if (observers.length === 0) {
        throw new Error(
          "No active ResizeObserver is observing this element, so nothing was notified. Render the component first, and check that it observes the element you passed."
        );
      }

      const entry = createResizeObserverEntry(target, size);
      for (const observer of observers) {
        observer.notify([entry]);
      }
      return entry;
    },
    restore,
  };
};
