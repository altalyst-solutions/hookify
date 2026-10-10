import type { RefObject } from "react";
import { useEffect } from "react";

import { useLatest } from "./use-latest";

/** A target accepted by {@link useEventListener}: the object itself or a ref to it. */
export type EventListenerTarget<T extends EventTarget> =
  T | RefObject<T | null> | null;

/** Call signatures of {@link useEventListener}. */
export interface UseEventListener {
  /** Listen on `window` (the default when no target is given). */
  <K extends keyof WindowEventMap>(
    type: K,
    handler: (event: WindowEventMap[K]) => void,
    target?: EventListenerTarget<Window>,
    options?: AddEventListenerOptions
  ): void;
  /** Listen on `document`. */
  <K extends keyof DocumentEventMap>(
    type: K,
    handler: (event: DocumentEventMap[K]) => void,
    target: EventListenerTarget<Document>,
    options?: AddEventListenerOptions
  ): void;
  /** Listen on an HTML element, or a ref to one. */
  <K extends keyof HTMLElementEventMap, T extends HTMLElement = HTMLElement>(
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    target: EventListenerTarget<T>,
    options?: AddEventListenerOptions
  ): void;
  /** Listen for any event on any `EventTarget` (custom events, `MediaQueryList`, ...). */
  <E extends Event = Event>(
    type: string,
    handler: (event: E) => void,
    target: EventListenerTarget<EventTarget>,
    options?: AddEventListenerOptions
  ): void;
}

const isRef = <T extends EventTarget>(
  target: T | RefObject<T | null>
): target is RefObject<T | null> => !("addEventListener" in target);

/**
 * Attaches an event listener to `window`, `document`, an element, or any
 * other `EventTarget`, and removes it automatically on cleanup.
 *
 * - **Target:** defaults to `window`. Pass `document`, an element, a ref, or
 *   any `EventTarget`. A `null` target (for example a ref that is not yet
 *   attached) attaches nothing.
 * - **Handler:** always the latest one is called, so passing an inline
 *   function never causes re-subscription.
 * - **Options:** standard `addEventListener` options (`capture`, `passive`,
 *   `once`, `signal`). Changing them re-subscribes; inline option objects are
 *   fine.
 * - **SSR:** does nothing when there is no DOM.
 *
 * Refs are read when the effect runs, so a ref that is attached in the same
 * commit works, but swapping `ref.current` later does not re-subscribe.
 *
 * @param type - The event name. The handler's event type is inferred from it for `window`, `document` and elements.
 * @param handler - Called with the event whenever it fires.
 * @param target - Where to listen. Defaults to `window`.
 * @param options - Standard `addEventListener` options.
 *
 * @example
 * ```tsx
 * // window
 * useEventListener("resize", () => setWidth(window.innerWidth));
 *
 * // document
 * useEventListener("keydown", (e) => e.key === "Escape" && close(), document);
 *
 * // element via ref
 * const ref = useRef<HTMLDivElement>(null);
 * useEventListener("scroll", (e) => console.log(e.currentTarget), ref, {
 *   passive: true,
 * });
 * ```
 */
export const useEventListener = (<E extends Event>(
  type: string,
  handler: (event: E) => void,
  target?: EventListenerTarget<EventTarget>,
  options?: AddEventListenerOptions
): void => {
  const handlerRef = useLatest(handler);
  const { capture, passive, once, signal } = options ?? {};

  useEffect(() => {
    const resolved =
      target === undefined
        ? typeof window === "undefined"
          ? null
          : window
        : target !== null && isRef(target)
          ? target.current
          : target;

    if (!resolved) return;

    const listener = (event: Event) => handlerRef.current(event as E);
    const listenerOptions = { capture, passive, once, signal };

    resolved.addEventListener(type, listener, listenerOptions);
    return () => resolved.removeEventListener(type, listener, listenerOptions);
  }, [type, target, handlerRef, capture, passive, once, signal]);
}) as UseEventListener;
