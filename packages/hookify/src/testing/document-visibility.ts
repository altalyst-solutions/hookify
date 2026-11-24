import { replaceProperty } from "./replace-global";

/** Options for {@link installDocumentVisibility}. */
export interface DocumentVisibilityOptions {
  /** The visibility state to start in. Default is `"visible"`. */
  visibilityState?: DocumentVisibilityState;
}

/** Returned by {@link installDocumentVisibility}. */
export interface DocumentVisibilityController {
  /** The current value of `document.visibilityState`. */
  readonly visibilityState: DocumentVisibilityState;
  /** The current value of `document.hidden`, `true` unless `"visible"`. */
  readonly hidden: boolean;
  /**
   * How many `visibilitychange` listeners have been added to the document since
   * the fake was installed. Adding a listener that is already registered
   * doesn't count. Use it to check that a component doesn't subscribe at all,
   * or doesn't subscribe again when it re-renders.
   */
  readonly listenersAdded: number;
  /**
   * How many `visibilitychange` listeners have been removed from the document
   * since the fake was installed.
   */
  readonly listenersRemoved: number;
  /**
   * How many `visibilitychange` listeners are registered on the document right
   * now, counting those added after the fake was installed. Adding the same
   * listener twice counts once, and a listener added with the `once` option
   * still counts after it has run, until it is removed explicitly.
   */
  readonly listenerCount: number;
  /**
   * Sets `document.visibilityState` and `document.hidden` and, if that changes
   * the state, fires `visibilitychange` on the document, as a browser does when
   * the tab is hidden or shown. Nothing happens if the document is already in
   * this state. Wrap it in `act()` if a listener updates React state.
   *
   * @param state - The new state.
   */
  setVisibility(state: DocumentVisibilityState): void;
  /**
   * Puts back everything the fake replaced on the document. Calling it more
   * than once does nothing.
   */
  restore(): void;
}

/**
 * Takes control of `document.visibilityState` and `document.hidden`.
 *
 * jsdom always reports the document as visible and never fires
 * `visibilitychange`, so components and hooks that pause work while a tab is
 * hidden can't be tested without help. This fake starts in the state you give
 * it (`"visible"` by default), lets you switch it with
 * {@link DocumentVisibilityController.setVisibility | setVisibility}, and counts
 * the `visibilitychange` listeners on the document so a test can check that a
 * component subscribes and cleans up. It doesn't depend on any test runner.
 *
 * It needs a `document`, so use a DOM test environment such as jsdom. Call
 * {@link DocumentVisibilityController.restore | restore} when the test ends,
 * such as in `afterEach`, so the fake doesn't leak into other tests. Events
 * fire synchronously, so wrap `setVisibility` in `act()` from your testing
 * library when a listener updates React state.
 *
 * @param options - See {@link DocumentVisibilityOptions}.
 * @returns A controller to change the state, inspect the listeners and restore
 * the document.
 *
 * @example
 * ```tsx
 * import { act, render, screen } from "@testing-library/react";
 * import { installDocumentVisibility } from "@altalyst/hookify/testing";
 *
 * const visibility = installDocumentVisibility();
 * afterEach(() => visibility.restore());
 *
 * it("pauses the clock while the tab is hidden", () => {
 *   render(<Clock />);
 *
 *   act(() => {
 *     visibility.setVisibility("hidden");
 *   });
 *
 *   expect(screen.getByText("Paused")).toBeInTheDocument();
 * });
 * ```
 *
 * @see {@link https://developer.mozilla.org/docs/Web/API/Document/visibilityState | visibilityState on MDN}
 */
export const installDocumentVisibility = (
  options: DocumentVisibilityOptions = {}
): DocumentVisibilityController => {
  if (typeof document === "undefined") {
    throw new Error(
      "installDocumentVisibility needs a document. Use a DOM test environment such as jsdom."
    );
  }

  /** The state the fake reports. */
  let state: DocumentVisibilityState = options.visibilityState ?? "visible";
  /** The `visibilitychange` listeners that are registered right now. */
  const listeners = new Set<EventListenerOrEventListenerObject>();
  /** How many listeners were added to and removed from `listeners`. */
  const counts = { added: 0, removed: 0 };

  const { addEventListener, removeEventListener } = document;

  const restorers = [
    replaceProperty(document, "visibilityState", { get: () => state }),
    replaceProperty(document, "hidden", { get: () => state !== "visible" }),
    replaceProperty(document, "addEventListener", {
      writable: true,
      value: (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
      ) => {
        if (type === "visibilitychange" && !listeners.has(listener)) {
          listeners.add(listener);
          counts.added++;
        }
        addEventListener.call(document, type, listener, options);
      },
    }),
    replaceProperty(document, "removeEventListener", {
      writable: true,
      value: (
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions
      ) => {
        if (type === "visibilitychange" && listeners.delete(listener)) {
          counts.removed++;
        }
        removeEventListener.call(document, type, listener, options);
      },
    }),
  ];

  return {
    get visibilityState() {
      return state;
    },
    get hidden() {
      return state !== "visible";
    },
    get listenersAdded() {
      return counts.added;
    },
    get listenersRemoved() {
      return counts.removed;
    },
    get listenerCount() {
      return listeners.size;
    },
    setVisibility(next) {
      if (next === state) return;
      state = next;
      document.dispatchEvent(new Event("visibilitychange"));
    },
    restore() {
      restorers.forEach((restore) => restore());
    },
  };
};
