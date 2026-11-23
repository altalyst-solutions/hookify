import assert from "node:assert/strict";

import {
  useDebouncedValue,
  useMediaQuery,
  useToggleState,
} from "@altalyst/hookify";
import { installIntersectionObserver } from "@altalyst/hookify/testing";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

const Probe = () => {
  const [on] = useToggleState(true);
  const debounced = useDebouncedValue("value", 100);
  const matches = useMediaQuery("(min-width: 1px)", { defaultValue: false });
  return createElement("p", null, `${on}:${debounced}:${matches}`);
};

assert.equal(renderToString(createElement(Probe)), "<p>true:value:false</p>");
console.log("ESM import renders on the server");

// The testing helpers install on `globalThis`, so they work without a DOM.
const observers = installIntersectionObserver();
const entries = [];
const target = {};
new IntersectionObserver((batch) => entries.push(...batch)).observe(target);
observers.trigger(target, { intersectionRatio: 0.5 });
observers.restore();

assert.equal(entries.length, 1);
assert.equal(entries[0].isIntersecting, true);
assert.equal(typeof IntersectionObserver, "undefined");
console.log("ESM import of the testing helpers works");
