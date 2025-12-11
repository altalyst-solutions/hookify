import { useCallback, useEffect, useRef } from "react";

/**
 * Configuration options for the useMounted hook.
 */
type UseMountedOptions = {
  /**
   * Callback function that is invoked when the component mounts.
   * Optionally returns a cleanup function that will be called before unmount.
   */
  onMount?: () => void | (() => void);
  /**
   * Callback function that is invoked when the component unmounts.
   */
  onUnmount?: () => void;
};

/**
 * A custom React hook for tracking whether a component is currently mounted.
 *
 * This hook provides a function that returns the current mount status of the component,
 * which is useful for preventing state updates or async operations after a component
 * has unmounted, thereby avoiding memory leaks and React warnings.
 *
 * Additionally, this hook supports lifecycle callbacks that can be executed on mount
 * and unmount. The `onMount` callback can optionally return a cleanup function,
 * similar to the return value of `useEffect`, providing a flexible way to set up
 * and tear down resources.
 *
 * This is particularly valuable in scenarios involving asynchronous operations
 * (like API calls or timers) where you need to verify the component is still mounted
 * before updating state with the async result.
 *
 * @param {UseMountedOptions} [options] - Optional configuration object:
 * - `onMount`: Callback invoked when the component mounts. Can return a cleanup function.
 * - `onUnmount`: Callback invoked when the component unmounts.
 * @returns {() => boolean} A function that returns `true` if the component is currently mounted,
 *                          and `false` if it has unmounted.
 *
 * @example
 * ```typescript
 * const isMounted = useMounted();
 *
 * useEffect(() => {
 *   fetchData().then(data => {
 *     if (isMounted()) {
 *       setData(data);
 *     }
 *   });
 * }, []);
 * ```
 *
 * @example
 * ```typescript
 * const isMounted = useMounted({
 *   onMount: () => {
 *     console.log('Component mounted');
 *     const interval = setInterval(() => console.log('tick'), 1000);
 *     return () => clearInterval(interval); // Cleanup function
 *   },
 *   onUnmount: () => {
 *     console.log('Component unmounted');
 *   }
 * });
 * ```
 */
export const useMounted = (options?: UseMountedOptions): (() => boolean) => {
  /**
   * A ref that tracks whether the component is currently mounted.
   * Initialized to `false` and set to `true` when the component mounts.
   */
  const isMounted = useRef(false);

  /**
   * A ref that stores the cleanup function returned by the `onMount` callback, if any.
   * This cleanup function will be invoked during the component's unmount phase.
   */
  const cleanupRef = useRef<(() => void) | void>();

  useEffect(() => {
    // Mark the component as mounted
    isMounted.current = true;

    // Execute the onMount callback if provided
    if (options?.onMount) {
      cleanupRef.current = options.onMount();
    }

    return () => {
      // Mark the component as unmounted
      isMounted.current = false;

      // Call cleanup from onMount if it returned one
      if (cleanupRef.current) {
        cleanupRef.current();
      }

      // Call onUnmount callback
      options?.onUnmount?.();
    };
  }, []);

  /**
   * Returns the current mount status of the component.
   * Memoized to provide a stable function reference across renders.
   * @returns {boolean} `true` if mounted, `false` if unmounted.
   */
  return useCallback((): boolean => isMounted.current, []);
};
