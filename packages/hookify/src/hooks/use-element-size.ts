import { useEffect, useRef, useState } from "react";

import { useLatest } from "./use-latest";

/** The width and height of an element, in CSS pixels. */
export interface ElementSize {
  width: number;
  height: number;
}

/** Options for {@link useElementSize}. */
export interface UseElementSizeOptions {
  /**
   * Which box to measure.
   *
   * - `"content-box"` (default): the content area, excluding padding and border.
   * - `"border-box"`: the content plus padding and border.
   */
  box?: "content-box" | "border-box";
  /**
   * Size reported on the server and until the element has been measured.
   * Only read on the first render. Defaults to `{ width: 0, height: 0 }`.
   */
  defaultSize?: ElementSize;
  /**
   * Called from the resize observer whenever the measured size changes,
   * including the first measurement. Receives the new size and the raw
   * `ResizeObserverEntry`, for example to read `contentRect` or the other
   * boxes. The latest callback is always used.
   */
  onResize?: (size: ElementSize, entry: ResizeObserverEntry) => void;
}

/** The object returned by {@link useElementSize}. */
export interface UseElementSizeResult<T extends Element> extends ElementSize {
  /** Attach this to the element you want to measure, as its `ref`. */
  ref: (element: T | null) => void;
}

const ZERO_SIZE: ElementSize = { width: 0, height: 0 };

const readSize = (
  entry: ResizeObserverEntry,
  box: "content-box" | "border-box"
): ElementSize => {
  if (box === "content-box") {
    // `contentRect` is physical (width/height), unlike `contentBoxSize`.
    return { width: entry.contentRect.width, height: entry.contentRect.height };
  }

  const borderBox = entry.borderBoxSize?.[0];
  if (!borderBox) {
    const rect = entry.target.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  // `borderBoxSize` is logical: inline/block swap in vertical writing modes.
  const vertical = /^(vertical|sideways)/.test(
    getComputedStyle(entry.target).writingMode
  );
  return vertical
    ? { width: borderBox.blockSize, height: borderBox.inlineSize }
    : { width: borderBox.inlineSize, height: borderBox.blockSize };
};

/**
 * Tracks the size of an element with a `ResizeObserver` and returns it as
 * state, so your component re-renders when the element is resized.
 *
 * - **Usage:** attach the returned `ref` to any element. It is a callback ref,
 *   so it also works when the element mounts later, is rendered conditionally,
 *   or is swapped for another one.
 * - **Efficient:** re-renders only when the width or height actually changes.
 * - **Box:** measures the content box by default; pass `box: "border-box"` to
 *   include padding and border.
 * - **Values:** fractional CSS pixels, exactly as reported by the browser.
 *   CSS transforms do not affect them. A `display: none` element measures
 *   `0` x `0`.
 * - **SSR-safe:** returns `defaultSize` on the server, on the first render, and
 *   wherever `ResizeObserver` is unavailable.
 * - **Cleanup:** the observer is disconnected on unmount and when the element
 *   or `box` changes. When the element unmounts, the last measured size is kept.
 *
 * The first measurement arrives after the element mounts, so the first render
 * (and the server render) uses `defaultSize`. To combine with another ref, call
 * both from a function ref, for example `ref={(el) => { ref(el); myRef.current = el; }}`.
 *
 * @typeParam T - The type of element being measured. Defaults to `HTMLElement`.
 * @param options - Optional `box`, `defaultSize` and `onResize` callback.
 * @returns The element's `width` and `height`, and the `ref` to attach to it.
 *
 * @example
 * ```tsx
 * const { ref, width, height } = useElementSize<HTMLDivElement>();
 *
 * return (
 *   <div ref={ref}>
 *     {Math.round(width)} x {Math.round(height)}
 *   </div>
 * );
 * ```
 *
 * @example
 * ```tsx
 * // Include padding and border, and react to every change
 * const { ref } = useElementSize<HTMLElement>({
 *   box: "border-box",
 *   onResize: ({ width }) => console.log("new width", width),
 * });
 * ```
 *
 * @example
 * ```tsx
 * // Compose your own helpers on top
 * const useIsNarrow = (limit: number) => {
 *   const { ref, width } = useElementSize<HTMLDivElement>();
 *   return { ref, isNarrow: width > 0 && width < limit };
 * };
 * ```
 *
 * For a live, editable example, see the [useElementSize docs page](https://altalyst-solutions.github.io/hookify/hooks/use-element-size).
 *
 * @see [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)
 */
export const useElementSize = <T extends Element = HTMLElement>(
  options?: UseElementSizeOptions
): UseElementSizeResult<T> => {
  const box = options?.box ?? "content-box";
  const onResizeRef = useLatest(options?.onResize);

  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState<ElementSize>(
    () => options?.defaultSize ?? ZERO_SIZE
  );
  // Last reported size, so identical measurements neither re-render nor
  // call `onResize` (for example when StrictMode observes the element twice).
  const lastSizeRef = useRef(size);

  useEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;

      const next = readSize(entry, box);
      const last = lastSizeRef.current;
      if (next.width === last.width && next.height === last.height) return;

      lastSizeRef.current = next;
      setSize(next);
      onResizeRef.current?.(next, entry);
    });

    observer.observe(element, { box });
    return () => observer.disconnect();
  }, [element, box, onResizeRef]);

  return { ref: setElement, width: size.width, height: size.height };
};
