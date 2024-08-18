import { useEffect, useRef } from "react";

/**
 * A custom React hook that triggers a callback function only after the component has mounted
 * and whenever the specified dependencies change.
 *
 * This hook is useful in cases where you want to skip the effect on the initial render and
 * only trigger it on subsequent renders when dependencies change.
 *
 * @param {() => void} fn - The callback function to be executed after the component mounts and dependencies change.
 * @param {unknown[]} [deps=[]] - An array of dependencies that the effect depends on. When these dependencies change,
 * the callback function will be triggered. If not provided, defaults to an empty array.
 *
 * @example
 * ```typescript
 * useEffectAfterMount(() => {
 *   console.log("This will only log on updates, not on the initial render");
 * }, [someDependency]);
 * ```
 */
export const useEffectAfterMount = (fn: () => void, deps: unknown[] = []) => {
  const isMounted = useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps]);
};
