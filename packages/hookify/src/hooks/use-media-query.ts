import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import { useLatest } from "./use-latest";

/** Options for {@link useMediaQuery}. */
export interface UseMediaQueryOptions {
  /**
   * Value returned on the server, during hydration, and whenever
   * `window.matchMedia` is unavailable.
   * Defaults to `false`.
   */
  defaultValue?: boolean;
  /** Called with the new match state whenever it changes (not on mount). */
  onChange?: (matches: boolean) => void;
}

const hasMatchMedia = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function";

/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 *
 * - **Hydration-safe:** built on `useSyncExternalStore`, so the server and the
 *   first client render both use `defaultValue`, then React re-renders with the
 *   real value if it differs.
 * - **Live:** re-renders only when the match state flips, not on every
 *   viewport change.
 * - **Dynamic queries:** changing `query` re-subscribes and re-reads the match.
 * - **Graceful fallback:** returns `defaultValue` when `matchMedia` is
 *   unavailable (SSR, some test environments).
 *
 * Any media feature works, not just widths: `prefers-color-scheme`,
 * `prefers-reduced-motion`, `orientation`, `hover`, `print` and so on.
 *
 * @param query - A CSS media query, for example `"(min-width: 768px)"`.
 * @param options - Optional `defaultValue` and `onChange` callback.
 * @returns `true` when the query currently matches.
 *
 * @example
 * ```tsx
 * const isDesktop = useMediaQuery("(min-width: 1024px)");
 * ```
 *
 * @example
 * ```tsx
 * // Reflect the user's OS setting, assuming "no match" until hydrated
 * const prefersDark = useMediaQuery("(prefers-color-scheme: dark)", {
 *   onChange: (dark) => console.log(dark ? "dark" : "light"),
 * });
 * ```
 *
 * @example
 * ```tsx
 * // Compose your own helpers on top
 * const useBreakpoint = (px: number) => useMediaQuery(`(min-width: ${px}px)`);
 * const usePrefersReducedMotion = () =>
 *   useMediaQuery("(prefers-reduced-motion: reduce)");
 * ```
 *
 * For a live, editable example, see the [useMediaQuery docs page](https://altalyst-solutions.github.io/hookify/hooks/use-media-query).
 *
 * @see [Using media queries from JavaScript](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Using_media_queries_from_JavaScript)
 */
export const useMediaQuery = (
  query: string,
  options?: UseMediaQueryOptions
): boolean => {
  const defaultValue = options?.defaultValue ?? false;
  const onChangeRef = useLatest(options?.onChange);

  const subscribe = useCallback(
    (notify: () => void) => {
      if (!hasMatchMedia()) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    [query]
  );

  const getSnapshot = useCallback(
    () => (hasMatchMedia() ? window.matchMedia(query).matches : defaultValue),
    [query, defaultValue]
  );

  const getServerSnapshot = useCallback(() => defaultValue, [defaultValue]);

  const matches = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const previousRef = useRef(matches);
  useEffect(() => {
    if (previousRef.current === matches) return;
    previousRef.current = matches;
    onChangeRef.current?.(matches);
  }, [matches, onChangeRef]);

  return matches;
};
