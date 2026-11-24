import {
  type UseMediaQueryOptions,
  useMediaQuery,
  useToggleState,
} from "@altalyst/hookify";
import {
  type DocumentVisibilityController,
  installDocumentVisibility,
  installMatchMedia,
  installResizeObserver,
  type MatchMediaController,
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

export const mediaProbe = (): MatchMediaController => {
  const media = installMatchMedia({ matches: false });

  media.setMatches("(min-width: 600px)", true);
  const matches: boolean = media.getMatches("(min-width: 600px)");
  const listeners: number = media.listenerCount();
  void matches;
  void listeners;

  // @ts-expect-error `matches` has to be a boolean.
  media.setMatches("(min-width: 600px)", "yes");

  return media;
};

export const visibilityProbe = (): DocumentVisibilityController => {
  const visibility = installDocumentVisibility({ visibilityState: "hidden" });

  visibility.setVisibility("visible");
  const hidden: boolean = visibility.hidden;
  void hidden;

  // @ts-expect-error Only real visibility states are accepted.
  visibility.setVisibility("sleeping");

  return visibility;
};
