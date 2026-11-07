import type { RefObject } from "react";
import { useEffect } from "react";

import { useLatest } from "./use-latest";

/**
 * Browsers emulate a `click` shortly after a tap. Clicks within this window of
 * a handled `touchstart` are treated as part of the same gesture.
 */
const EMULATED_CLICK_WINDOW_MS = 1000;

/**
 * A custom React hook that triggers a callback function when a click or touch event occurs outside the specified element.
 *
 * This hook is useful for handling scenarios like closing dropdowns, modals, or tooltips when clicking outside the component.
 *
 * A tap on a touch screen fires the callback once, even though the browser dispatches both a `touchstart` and an emulated `click`. The latest `callback` is always used, so it does not need to be memoized.
 *
 * @param ref - A React ref object pointing to the element to detect outside clicks for.
 * @param callback - The callback function to execute when a click or touch event occurs outside the specified element.
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useOutsideClick(ref, () => {
 *   console.log("Clicked outside the component");
 * });
 *
 * return <div ref={ref}>Click outside this element</div>;
 * ```
 *
 * For a live, editable example, see the [useOutsideClick docs page](https://altalyst-solutions.github.io/hookify/hooks/use-outside-click).
 */
export const useOutsideClick = (
  ref: RefObject<HTMLElement | null>,
  callback: () => void
): void => {
  const callbackRef = useLatest(callback);

  useEffect(() => {
    let ignoreClicksUntil = -Infinity;

    const isOutside = (event: Event) =>
      ref.current !== null && !ref.current.contains(event.target as Node);

    const handleTouchStart = (event: TouchEvent) => {
      if (!isOutside(event)) return;
      ignoreClicksUntil = event.timeStamp + EMULATED_CLICK_WINDOW_MS;
      callbackRef.current();
    };

    const handleClick = (event: MouseEvent) => {
      if (event.timeStamp <= ignoreClicksUntil) {
        ignoreClicksUntil = -Infinity;
        return;
      }
      if (isOutside(event)) callbackRef.current();
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("touchstart", handleTouchStart);

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("touchstart", handleTouchStart);
    };
  }, [ref, callbackRef]);
};
