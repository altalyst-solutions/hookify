import type { RefObject } from "react";
import { useEffect } from "react";

/**
 * A custom React hook that triggers a callback function when a click or touch event occurs outside the specified element.
 *
 * This hook is useful for handling scenarios like closing dropdowns, modals, or tooltips when clicking outside the component.
 *
 * @param {RefObject<HTMLElement>} ref - A React ref object pointing to the element to detect outside clicks for.
 * @param {() => void} callback - The callback function to execute when a click or touch event occurs outside the specified element.
 *
 * @example
 * ```typescript
 * const ref = useRef<HTMLDivElement>(null);
 * useOutsideClick(ref, () => {
 *   console.log("Clicked outside the component");
 * });
 *
 * return <div ref={ref}>Click outside this element</div>;
 * ```
 *
 * For a complete example, see [examples/useOutsideClick.ts](../../examples/basic/src/components/use-outside-click/index.tsx).
 */
export const useOutsideClick = (
  ref: RefObject<HTMLElement>,
  callback: () => void
) => {
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener("click", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("click", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [ref, callback]);
};
