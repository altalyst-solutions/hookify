import { useEffect, useRef, useState } from "react";

import { useLatest } from "./use-latest";

/** Options for {@link useImpression}. */
export interface UseImpressionOptions {
  /**
   * How much of the element must be visible, from `0` to `1`, to count as
   * seen. Values outside that range are clamped. Default is `0.5`.
   */
  threshold?: number;
  /**
   * How long, in milliseconds, the element must stay at least `threshold`
   * visible before the impression is reported. Leaving the viewport before
   * then resets the timer. A value of `0` reports as soon as the element is
   * visible. A negative or non-finite value falls back to the default.
   * Default is `1000`.
   */
  minDurationMs?: number;
  /**
   * Report a single impression for the element. When `false`, the element can
   * be reported again each time it leaves the viewport and then stays visible
   * for `minDurationMs` again. Default is `true`.
   */
  once?: boolean;
  /**
   * The element used as the viewport for the check. Pass a scrollable
   * container to track visibility inside it. Passing a new element
   * re-observes. Default is the browser viewport (`null`).
   */
  root?: Element | Document | null;
  /**
   * Grows or shrinks the root's box before computing visibility, using CSS
   * margin syntax, for example `"-50px"` to ignore a fixed header. Default is
   * `"0px"`.
   */
  rootMargin?: string;
  /**
   * Set to `false` to stop observing and discard any running timer. Turning it
   * back on starts a fresh dwell timer. Default is `true`.
   */
  enabled?: boolean;
}

/** Default for {@link UseImpressionOptions.threshold}. */
const DEFAULT_THRESHOLD = 0.5;

/** Default for {@link UseImpressionOptions.minDurationMs}, in milliseconds. */
const DEFAULT_MIN_DURATION_MS = 1000;

/**
 * Calls `onImpression` once an element has been at least `threshold` visible
 * for at least `minDurationMs`, which is what analytics, "mark as read" and
 * ad-view tracking usually mean by "seen".
 *
 * It differs from {@link useIntersectionObserver}, which reports visibility as
 * state but has no notion of dwell time, and the hook itself never re-renders
 * your component.
 *
 * - **Usage:** attach the returned `ref` to any element. It is a callback ref,
 *   so it also works when the element mounts later, is rendered conditionally,
 *   or is swapped for another one.
 * - **Dwell time:** the timer starts when the element becomes visible enough
 *   and is reset if it drops below `threshold` before `minDurationMs` passes.
 * - **Hidden tabs:** the timer is paused while the document is hidden, so time
 *   in a background tab does not count, and it resumes when the tab is visible
 *   again.
 * - **Once or repeated:** by default one impression is reported per element.
 *   With `once: false`, the element is reported again after it leaves the
 *   viewport and stays visible for `minDurationMs` again.
 * - **Stable:** the latest `onImpression` is always called, so passing an
 *   inline function never resets the timer or re-observes. Changing `root`,
 *   `rootMargin`, `threshold`, `minDurationMs`, `once` or `enabled` does.
 * - **Pause:** `enabled: false` disconnects the observer and clears the timer.
 * - **SSR-safe:** nothing runs on the server, and it does nothing where
 *   `IntersectionObserver` is unavailable.
 * - **Cleanup:** the observer, the timer and the visibility listener are
 *   removed on unmount, when the element changes and when an option changes.
 *   The callback is never called after unmount.
 *
 * @typeParam T - The type of element being observed. Defaults to `HTMLElement`.
 * @param onImpression - Called with the latest `IntersectionObserverEntry` when an impression is reported.
 * @param options - Optional `threshold`, `minDurationMs`, `once`, `root`, `rootMargin` and `enabled` settings. See {@link UseImpressionOptions | UseImpressionOptions}.
 * @returns A callback `ref` to attach to the element you want to track.
 *
 * @example
 * ```tsx
 * // Report a view after the card was at least half visible for one second
 * const ref = useImpression<HTMLDivElement>(() => {
 *   analytics.track("card_viewed", { id });
 * });
 *
 * return <div ref={ref}>{children}</div>;
 * ```
 *
 * @example
 * ```tsx
 * // Mark a message as read after 2 seconds with 80% of it on screen
 * const ref = useImpression<HTMLLIElement>(() => markAsRead(message.id), {
 *   threshold: 0.8,
 *   minDurationMs: 2000,
 *   enabled: !message.read,
 * });
 * ```
 *
 * @example
 * ```tsx
 * // Count every time an ad is seen again, inside a scrollable feed
 * const ref = useImpression<HTMLDivElement>(
 *   (entry) => trackAdView(adId, entry.intersectionRatio),
 *   { once: false, root: feedRef.current }
 * );
 * ```
 *
 * For a live, editable example, see the [useImpression docs page](https://altalyst-solutions.github.io/hookify/hooks/use-impression).
 *
 * @see [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver)
 * @see [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
 */
export const useImpression = <T extends Element = HTMLElement>(
  onImpression: (entry: IntersectionObserverEntry) => void,
  options?: UseImpressionOptions
): ((element: T | null) => void) => {
  /** The threshold as passed, before it is validated. */
  const rawThreshold = options?.threshold ?? DEFAULT_THRESHOLD;
  /** The visibility ratio to reach, clamped to what `IntersectionObserver` accepts (`0` to `1`). */
  const threshold = Number.isNaN(rawThreshold)
    ? DEFAULT_THRESHOLD
    : Math.min(1, Math.max(0, rawThreshold));
  /** The dwell time as passed, before it is validated. */
  const rawDuration = options?.minDurationMs ?? DEFAULT_MIN_DURATION_MS;
  /** The dwell time to wait, in milliseconds. Never negative or non-finite. */
  const minDurationMs =
    Number.isFinite(rawDuration) && rawDuration >= 0
      ? rawDuration
      : DEFAULT_MIN_DURATION_MS;
  /** Whether to report a single impression per element. */
  const once = options?.once ?? true;
  /** The viewport used for the check, `null` for the browser viewport. */
  const root = options?.root ?? null;
  /** The margin applied to the root's box, in CSS margin syntax. */
  const rootMargin = options?.rootMargin ?? "0px";
  /** Whether tracking is on. */
  const enabled = options?.enabled ?? true;

  /** Holds the latest `onImpression`, so changing it never re-observes. */
  const onImpressionRef = useLatest(onImpression);

  /** The element being tracked. Set by the returned callback ref. */
  const [element, setElement] = useState<T | null>(null);

  /**
   * The element that already got its impression while `once` was on, so that
   * toggling `enabled` or changing an option does not report it a second time.
   */
  const reportedRef = useRef<T | null>(null);

  useEffect(() => {
    if (
      !enabled ||
      !element ||
      (once && reportedRef.current === element) ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    /** The latest entry for the element, passed to `onImpression`. */
    let latestEntry: IntersectionObserverEntry | undefined;
    /** Whether the element is currently visible by at least `threshold`. */
    let isVisibleEnough = false;
    /** Whether the current visible stretch was already reported. */
    let reported = false;
    /** The running dwell timer, if any. */
    let timer: ReturnType<typeof setTimeout> | undefined;
    /** Dwell time still needed, in milliseconds. Shrinks while paused. */
    let remainingMs = minDurationMs;
    /** When the running timer started, in milliseconds since the epoch. */
    let startedAt = 0;

    /**
     * Stops the running timer, if any, and subtracts the time it already ran
     * from `remainingMs`, so a later `startTimer` continues where it left off.
     */
    const stopTimer = () => {
      if (timer === undefined) return;
      clearTimeout(timer);
      timer = undefined;
      remainingMs = Math.max(0, remainingMs - (Date.now() - startedAt));
    };

    /**
     * Starts the dwell timer for the time left in `remainingMs`. Does nothing
     * if it is already running, the current visible stretch was reported, the
     * element is not visible enough, or the document is hidden.
     */
    const startTimer = () => {
      if (
        timer !== undefined ||
        reported ||
        !isVisibleEnough ||
        document.visibilityState === "hidden"
      ) {
        return;
      }
      startedAt = Date.now();
      timer = setTimeout(report, remainingMs);
    };

    /**
     * Runs when the dwell time has passed: marks the visible stretch as
     * reported, stops observing when `once` is on, and calls `onImpression`
     * with the latest entry.
     */
    const report = () => {
      timer = undefined;
      reported = true;
      if (once) {
        reportedRef.current = element;
        observer.disconnect();
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      if (latestEntry) onImpressionRef.current(latestEntry);
    };

    /** Pauses the timer when the document gets hidden and resumes it when shown. */
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") stopTimer();
      else startTimer();
    };

    /**
     * Tracks whether the element is visible enough. The timer runs while it
     * is, and dropping below `threshold` resets the dwell time.
     */
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        latestEntry = entry;
        isVisibleEnough =
          entry.isIntersecting && entry.intersectionRatio >= threshold;

        if (isVisibleEnough) {
          startTimer();
        } else {
          // Leaving the viewport starts the next dwell from zero.
          stopTimer();
          remainingMs = minDurationMs;
          reported = false;
        }
      },
      { root, rootMargin, threshold }
    );

    observer.observe(element);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [
    element,
    enabled,
    minDurationMs,
    once,
    onImpressionRef,
    root,
    rootMargin,
    threshold,
  ]);

  return setElement;
};
