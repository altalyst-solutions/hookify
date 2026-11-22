// A CommonJS module, so `node16` resolution picks the `require` condition.
import {
  type UseMediaQueryOptions,
  useMediaQuery,
  useToggleState,
} from "@altalyst/hookify";

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
