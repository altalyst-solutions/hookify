import { useEffect, useState } from "react";

import { useLatest } from "./use-latest";

/** Options for {@link useIntersectionObserver}. */
export interface UseIntersectionObserverOptions {
  /**
   * The element (or document) used as the viewport for the check. Defaults to
   * the browser viewport. Pass a scrollable container to track visibility
   * inside it. Passing a new element re-observes.
   */
  root?: Element | Document | null;
  /**
   * Grows or shrinks the root's box before computing intersections, using CSS
   * margin syntax, for example `"200px"` to start loading before an element
   * scrolls into view. Defaults to `"0px"`.
   */
  rootMargin?: string;
  /**
   * How much of the element must be visible, from `0` to `1`, before it counts
   * as intersecting. Pass an array to be notified at several ratios (use
   * `onChange` to read `entry.intersectionRatio`). Defaults to `0`.
   */
  threshold?: number | number[];
  /**
   * Set to `false` to pause observing, for example while a feature is off.
   * The last value is kept, and observing resumes when it is `true` again.
   * Defaults to `true`.
   */
  enabled?: boolean;
  /**
   * Stop observing after the element first intersects and keep reporting
   * `true`, which suits lazy-loading and reveal-once animations. Defaults to
   * `false`.
   */
  once?: boolean;
  /**
   * Value reported on the server and until the element has been observed.
   * Only read on the first render. Defaults to `false`.
   */
  defaultIsIntersecting?: boolean;
  /**
   * Called with the raw `IntersectionObserverEntry` for every notification,
   * including the first one right after observing starts. Use it to read
   * `intersectionRatio`, `boundingClientRect` and more, or to run side effects
   * without waiting for a re-render. The latest callback is always used.
   */
  onChange?: (entry: IntersectionObserverEntry) => void;
}

/** The object returned by {@link useIntersectionObserver}. */
export interface UseIntersectionObserverResult<T extends Element> {
  /** Attach this to the element you want to observe, as its `ref`. */
  ref: (element: T | null) => void;
  /** Whether the element currently intersects the root. */
  isIntersecting: boolean;
  /**
   * The most recent `IntersectionObserverEntry` for the attached element, or
   * `undefined` before the first notification, on the server, and while no
   * element is attached.
   */
  entry: IntersectionObserverEntry | undefined;
}

/**
 * Tracks whether an element is visible in the viewport (or inside a scroll
 * container) with an `IntersectionObserver`, and returns it as state so your
 * component re-renders when visibility changes.
 *
 * - **Usage:** attach the returned `ref` to any element. It is a callback ref,
 *   so it also works when the element mounts later, is rendered conditionally,
 *   or is swapped for another one.
 * - **Efficient:** re-renders only when the browser reports a change, which is
 *   when the element crosses one of the `threshold` ratios.
 * - **Options:** `root`, `rootMargin` and `threshold` go straight to the
 *   observer. Inline `threshold` arrays are fine, they do not re-observe unless
 *   their values change.
 * - **Extensible:** read the raw `entry` from the result, or react to every
 *   notification with `onChange`, to build your own helpers.
 * - **Once:** `once: true` stops observing after the first time the element
 *   is seen, for lazy-loading and reveal-once animations.
 * - **Pause:** `enabled: false` pauses observing and keeps the last value.
 * - **SSR-safe:** returns `defaultIsIntersecting` on the server, on the first
 *   render, and wherever `IntersectionObserver` is unavailable.
 * - **Cleanup:** the observer is disconnected on unmount, when the element or
 *   an option changes, and when `enabled` becomes `false`. When the element
 *   is detached, the result goes back to its defaults.
 *
 * The first notification arrives after the element mounts, so the first render
 * (and the server render) uses `defaultIsIntersecting`. To combine the `ref`
 * with another ref, call both from a function ref, for example
 * `ref={(el) => { ref(el); myRef.current = el; }}`.
 *
 * @typeParam T - The type of element being observed. Defaults to `HTMLElement`.
 * @param options - Optional `root`, `rootMargin`, `threshold`, `enabled`, `once`, `defaultIsIntersecting` and `onChange` settings.
 * @returns Whether the element `isIntersecting`, its latest `entry`, and the `ref` to attach to it.
 *
 * @example
 * ```tsx
 * const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>();
 *
 * return <div ref={ref}>{isIntersecting ? "Visible" : "Hidden"}</div>;
 * ```
 *
 * @example
 * ```tsx
 * // Lazy-load an image 200px before it scrolls into view, only once
 * const { ref, isIntersecting } = useIntersectionObserver<HTMLImageElement>({
 *   rootMargin: "200px",
 *   once: true,
 * });
 *
 * return <img ref={ref} src={isIntersecting ? src : undefined} alt="" />;
 * ```
 *
 * @example
 * ```tsx
 * // Read how much is visible, without waiting for a re-render
 * const { ref } = useIntersectionObserver<HTMLElement>({
 *   threshold: [0, 0.25, 0.5, 0.75, 1],
 *   onChange: (entry) => console.log(entry.intersectionRatio),
 * });
 * ```
 *
 * @example
 * ```tsx
 * // Compose your own helpers on top
 * const useIsMostlyVisible = () => {
 *   const { ref, entry } = useIntersectionObserver<HTMLElement>({
 *     threshold: [0, 0.5, 1],
 *   });
 *   return { ref, mostlyVisible: (entry?.intersectionRatio ?? 0) >= 0.5 };
 * };
 * ```
 *
 * For a live, editable example, see the [useIntersectionObserver docs page](https://altalyst-solutions.github.io/hookify/hooks/use-intersection-observer).
 *
 * @see [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver)
 */
export const useIntersectionObserver = <T extends Element = HTMLElement>(
  options?: UseIntersectionObserverOptions
): UseIntersectionObserverResult<T> => {
  const root = options?.root ?? null;
  const rootMargin = options?.rootMargin ?? "0px";
  const enabled = options?.enabled ?? true;
  const once = options?.once ?? false;
  const onChangeRef = useLatest(options?.onChange);

  // A string key lets callers pass inline arrays without re-observing.
  const thresholdKey = [options?.threshold ?? 0].flat().join(",");

  const [element, setElement] = useState<T | null>(null);
  const [rawEntry, setRawEntry] = useState<IntersectionObserverEntry>();
  const [defaultIsIntersecting] = useState(
    () => options?.defaultIsIntersecting ?? false
  );

  // Ignore an entry that belongs to a previous element.
  const entry = element && rawEntry?.target === element ? rawEntry : undefined;
  const isIntersecting = entry ? entry.isIntersecting : defaultIsIntersecting;
  const done = once && isIntersecting && entry !== undefined;

  useEffect(() => {
    if (
      !enabled ||
      done ||
      !element ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const next of entries) onChangeRef.current?.(next);
        const last = entries[entries.length - 1];
        if (last) setRawEntry(last);
      },
      { root, rootMargin, threshold: thresholdKey.split(",").map(Number) }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [element, root, rootMargin, thresholdKey, enabled, done, onChangeRef]);

  return { ref: setElement, isIntersecting, entry };
};
