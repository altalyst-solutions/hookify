import { useEffect, useLayoutEffect } from "react";

// `window.document.createElement` also rules out environments such as React
// Native, which define `window` but have no DOM.
const canUseDOM =
  typeof window !== "undefined" &&
  typeof window.document?.createElement === "function";

/**
 * A drop-in replacement for `useLayoutEffect` that is safe to use in
 * server-rendered apps.
 *
 * In the browser it is `useLayoutEffect`: the effect runs synchronously after
 * React updates the DOM and before the browser paints, so you can measure or
 * adjust the layout without a visible flicker. Where there is no DOM (server
 * rendering, React Native) it falls back to `useEffect`. Neither runs during
 * server rendering, but `useLayoutEffect` triggers a warning there in
 * React 18, which this avoids.
 *
 * It has exactly the same signature and semantics as `useLayoutEffect`, so it
 * can be swapped in anywhere, including inside your own hooks. The choice is
 * made once, when the module loads.
 *
 * To have `react-hooks/exhaustive-deps` check its dependencies, add it to the
 * rule's `additionalHooks` option.
 *
 * @param effect - The effect to run. May return a cleanup function.
 * @param deps - Dependencies that control when the effect re-runs, as with `useLayoutEffect`.
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLTextAreaElement>(null);
 *
 * useIsomorphicLayoutEffect(() => {
 *   const el = ref.current;
 *   if (!el) return;
 *   el.style.height = "auto";
 *   el.style.height = `${el.scrollHeight}px`;
 * }, [value]);
 * ```
 */
export const useIsomorphicLayoutEffect: typeof useLayoutEffect = canUseDOM
  ? useLayoutEffect
  : useEffect;
