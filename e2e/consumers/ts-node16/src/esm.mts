// An ES module, so `node16` resolution picks the `import` condition.
import {
  type UseMediaQueryOptions,
  useMediaQuery,
  useToggleState,
} from "@altalyst/hookify";
import {
  installResizeObserver,
  type ResizeObserverController,
} from "@altalyst/hookify/testing";

export const probe = (): [boolean, boolean] => {
  const options: UseMediaQueryOptions = { defaultValue: false };
  const [on, toggle] = useToggleState(true);
  const matches: boolean = useMediaQuery("(min-width: 1px)", options);
  const toggleFn: () => void = toggle;

  // The declarations must be real types, not `any`.
  // @ts-expect-error The initial state has to be a boolean.
  useToggleState("nope");

  void toggleFn;
  return [on, matches];
};

// The `./testing` subpath must resolve to real types too.
export const testingProbe = (): ResizeObserverController => {
  const observers = installResizeObserver();
  const el = document.createElement("div");
  new ResizeObserver(() => {}).observe(el);

  const entry: ResizeObserverEntry = observers.trigger(el, { width: 10 });
  void entry;

  // @ts-expect-error The target has to be an element.
  observers.trigger("nope");

  return observers;
};
