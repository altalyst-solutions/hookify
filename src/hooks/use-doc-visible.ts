import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Configuration options for the useDocVisible hook.
 */
type UseDocVisibleOptions = {
  /** Callback function invoked when the document's visibility changes. Receives the new visibility state as a parameter. */
  onChange?: (isVisible: boolean) => void;
};

/**
 * Subscribe function for document visibility changes.
 *
 * This function sets up an event listener for the browser's `visibilitychange` event
 * and returns a cleanup function to remove the listener when the subscription ends.
 *
 * @param {() => void} callback - The callback function to invoke when visibility changes.
 * @returns {() => void} A cleanup function to unsubscribe from the event.
 */
const subscribe = (callback: () => void): (() => void) => {
  document.addEventListener("visibilitychange", callback);
  return () => {
    document.removeEventListener("visibilitychange", callback);
  };
};

/**
 * Gets the current document visibility state.
 *
 * This function reads the browser's `document.visibilityState` API to determine
 * if the document is currently visible to the user.
 *
 * @returns {boolean} True if the document is visible, false otherwise.
 */
const getSnapshot = (): boolean => {
  return document.visibilityState === "visible";
};

/**
 * Gets the server-side snapshot for SSR compatibility.
 *
 * During server-side rendering, the document API is not available. This function
 * returns a default value of `true` to ensure the hook works correctly in SSR
 * environments without causing hydration mismatches.
 *
 * @returns {boolean} Always returns true for SSR compatibility.
 */
const getServerSnapshot = (): boolean => {
  return true;
};

/**
 * A custom React hook that tracks whether the browser document/tab is currently visible to the user.
 *
 * This hook uses `useSyncExternalStore` to efficiently monitor the browser's visibility state,
 * providing optimal performance and preventing tearing in concurrent rendering scenarios.
 * It leverages the Page Visibility API to detect when users switch tabs, minimize the browser,
 * or return to the page.
 *
 * The hook is particularly useful for optimizing application performance by pausing expensive
 * operations when the user is not actively viewing the page, such as stopping API polling,
 * pausing animations, or deferring computationally intensive tasks.
 *
 * In server-side rendering environments, the hook safely defaults to `true` (visible state)
 * to prevent hydration issues and ensure consistent behavior across server and client.
 *
 * The optional `onChange` callback provides a convenient way to respond to visibility changes
 * without needing additional `useEffect` hooks in the consuming component.
 *
 * @param {UseDocVisibleOptions} [options] - Optional configuration for the hook, including an onChange callback.
 * @returns {boolean} Returns `true` if the document is visible, `false` if it's hidden.
 *
 * @example
 * ```typescript
 * const isVisible = useDocVisible();
 *
 * useEffect(() => {
 *   if (isVisible) {
 *     // Resume polling or animations
 *   } else {
 *     // Pause expensive operations
 *   }
 * }, [isVisible]);
 * ```
 *
 * @example
 * ```typescript
 * // With onChange callback
 * const isVisible = useDocVisible({
 *   onChange: (visible) => {
 *     console.log(`Tab is now ${visible ? 'visible' : 'hidden'}`);
 *   }
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Pause video playback when tab is hidden
 * const videoRef = useRef<HTMLVideoElement>(null);
 * const isVisible = useDocVisible({
 *   onChange: (visible) => {
 *     if (videoRef.current) {
 *       visible ? videoRef.current.play() : videoRef.current.pause();
 *     }
 *   }
 * });
 * ```
 *
 * For a complete example, see [examples/useDocVisible.ts](../../examples/basic/src/components/use-doc-visible/index.tsx).
 *
 * @see [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
 */
export const useDocVisible = (options?: UseDocVisibleOptions): boolean => {
  /**
   * Current visibility state of the document.
   * Synchronized with the browser's visibility API via useSyncExternalStore.
   */
  const isVisible = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  /**
   * Ref to store the onChange callback function.
   * Using a ref ensures the callback can be updated without re-subscribing to the event.
   */
  const onChangeRef = useRef(options?.onChange);

  /**
   * Ref to track the previous visibility state.
   * Used to detect actual changes and prevent calling onChange with the same value.
   */
  const prevVisibleRef = useRef(isVisible);

  // Keep callback ref up to date
  useEffect(() => {
    onChangeRef.current = options?.onChange;
  }, [options?.onChange]);

  // Trigger onChange callback when visibility changes
  useEffect(() => {
    if (prevVisibleRef.current !== isVisible) {
      prevVisibleRef.current = isVisible;
      onChangeRef.current?.(isVisible);
    }
  }, [isVisible]);

  return isVisible;
};
