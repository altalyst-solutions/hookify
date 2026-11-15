import { useCallback, useRef } from "react";

import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";

type AnyFunction = (...args: never[]) => unknown;

/**
 * The signature of {@link useStableCallback}: the wrapped function keeps its
 * type, and gains `undefined` in its return type when `callback` can be
 * `null` or `undefined`.
 */
export interface UseStableCallback {
  <T extends AnyFunction>(callback: T): T;
  <T extends AnyFunction>(
    callback: T | null | undefined
  ): (...args: Parameters<T>) => ReturnType<T> | undefined;
}

/**
 * Returns a function with a permanent identity that always calls the latest
 * `callback`.
 *
 * Use it to pass a handler to a memoized child, a dependency array or a
 * long-lived subscription (timers, listeners, observers) without
 * re-creating or re-subscribing it on every render, and without reading
 * stale props or state. Arguments, `this` and the return value are passed
 * through, so it can wrap any function without changing its type.
 *
 * `callback` may also be `null` or `undefined`, which is handy for optional
 * props: the returned function then does nothing and returns `undefined`.
 *
 * The latest `callback` is stored in a layout effect, so it is in place
 * before effects and event handlers run, but it is not updated during
 * render. Call the returned function from event handlers, effects and other
 * callbacks, not while rendering. For reading a value rather than calling a
 * function, see `useLatest`.
 *
 * @typeParam T - The type of the wrapped function.
 * @param callback - The function to call, or `null`/`undefined` for none.
 * @returns A stable function with the same signature as `callback`. If
 * `callback` can be `null` or `undefined`, its return type also includes
 * `undefined`.
 *
 * @example
 * ```tsx
 * // A memoized child never re-renders because of the handler
 * const handleSelect = useStableCallback((id: string) => {
 *   setSelected(id);
 *   analytics.track(id, filter);
 * });
 *
 * return <MemoList onSelect={handleSelect} />;
 * ```
 *
 * @example
 * ```tsx
 * // Subscribe once, always call the latest handler
 * const onMessage = useStableCallback((message: string) => {
 *   setLog((log) => [...log, `${user}: ${message}`]);
 * });
 *
 * useEffect(() => {
 *   const socket = connect(url);
 *   socket.on("message", onMessage);
 *   return () => socket.close();
 * }, [url, onMessage]);
 * ```
 *
 * @example
 * ```tsx
 * // Optional prop: safe to call without `?.`
 * const notify = useStableCallback(props.onChange);
 * ```
 *
 * For a live, editable example, see the [useStableCallback docs page](https://altalyst-solutions.github.io/hookify/hooks/use-stable-callback).
 */
export const useStableCallback = (<T extends AnyFunction>(
  callback: T | null | undefined
) => {
  const ref = useRef(callback);

  useIsomorphicLayoutEffect(() => {
    ref.current = callback;
  });

  return useCallback(function (this: unknown, ...args: Parameters<T>) {
    return ref.current?.apply(this, args);
  }, []);
}) as UseStableCallback;
