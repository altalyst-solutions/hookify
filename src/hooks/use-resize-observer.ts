import { useEffect, useState } from "react";

import { useLatest } from "./use-latest";

/** Options for {@link useResizeObserver}. */
export interface UseResizeObserverOptions {
  /**
   * Which box to observe, passed straight to `ResizeObserver.observe`.
   * Defaults to `"content-box"`. Use `"device-pixel-content-box"` for
   * device-pixel measurements (for example to size a `<canvas>` crisply).
   */
  box?: ResizeObserverBoxOptions;
  /**
   * Set to `false` to pause observing, for example while a panel is closed.
   * Observing resumes (and reports the current size) when it is `true` again.
   * Defaults to `true`.
   */
  enabled?: boolean;
}

/**
 * Called with the raw `ResizeObserverEntry` each time the observed element is
 * resized, including once right after observing starts.
 */
export type ResizeObserverHandler = (
  entry: ResizeObserverEntry,
  observer: ResizeObserver
) => void;

/**
 * Runs a callback whenever an element is resized, using a `ResizeObserver`.
 * It is the low-level building block behind size-tracking hooks: it hands you
 * the raw `ResizeObserverEntry` and holds no state, so it never re-renders your
 * component on its own. Need the size as state? Use `useElementSize`.
 *
 * - **Usage:** attach the returned `ref` to any element. It is a callback ref,
 *   so it also works when the element mounts later, is rendered conditionally,
 *   or is swapped for another one.
 * - **Raw entry:** the callback gets the `ResizeObserverEntry`, so you choose
 *   what to read (`contentRect`, `borderBoxSize`, `devicePixelContentBoxSize`,
 *   ...) and where to put it (state, a ref, a canvas, a store).
 * - **Latest callback:** the callback may change on every render without
 *   re-observing the element.
 * - **Options:** pick the observed `box`, or pause with `enabled: false`.
 * - **SSR-safe:** does nothing on the server, and wherever `ResizeObserver` is
 *   unavailable.
 * - **Cleanup:** the observer is disconnected on unmount, when the element
 *   changes, when `box` changes, and when `enabled` becomes `false`.
 *
 * A `ResizeObserver` reports once as soon as observing starts, so the callback
 * runs with the initial size after the element mounts. To combine the `ref`
 * with another ref, call both from a function ref, for example
 * `ref={(el) => { ref(el); myRef.current = el; }}`.
 *
 * @typeParam T - The type of element being observed. Defaults to `HTMLElement`.
 * @param callback - Called with the `ResizeObserverEntry` and the observer on every resize.
 * @param options - Optional `box` and `enabled` settings.
 * @returns A callback `ref` to attach to the element you want to observe.
 *
 * @example
 * ```tsx
 * const ref = useResizeObserver<HTMLDivElement>((entry) => {
 *   console.log("width", entry.contentRect.width);
 * });
 *
 * return <div ref={ref} />;
 * ```
 *
 * @example
 * ```tsx
 * // Keep a canvas sharp by reading device pixels, without re-rendering
 * const ref = useResizeObserver<HTMLCanvasElement>(
 *   (entry) => {
 *     const size = entry.devicePixelContentBoxSize?.[0];
 *     if (!size) return;
 *     entry.target.width = size.inlineSize;
 *     entry.target.height = size.blockSize;
 *   },
 *   { box: "device-pixel-content-box" }
 * );
 * ```
 *
 * @example
 * ```tsx
 * // Compose your own helpers on top
 * const useWidth = (enabled = true) => {
 *   const [width, setWidth] = useState(0);
 *   const ref = useResizeObserver<HTMLElement>(
 *     (entry) => setWidth(entry.contentRect.width),
 *     { enabled }
 *   );
 *   return { ref, width };
 * };
 * ```
 *
 * For a live, editable example, see the [useResizeObserver docs page](https://altalyst-solutions.github.io/hookify/hooks/use-resize-observer).
 *
 * @see [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)
 */
export const useResizeObserver = <T extends Element = HTMLElement>(
  callback: ResizeObserverHandler,
  options?: UseResizeObserverOptions
): ((element: T | null) => void) => {
  const box = options?.box ?? "content-box";
  const enabled = options?.enabled ?? true;
  const callbackRef = useLatest(callback);

  const [element, setElement] = useState<T | null>(null);

  useEffect(() => {
    if (!enabled || !element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries, self) => {
      for (const entry of entries) callbackRef.current(entry, self);
    });

    observer.observe(element, { box });
    return () => observer.disconnect();
  }, [element, box, enabled, callbackRef]);

  return setElement;
};
