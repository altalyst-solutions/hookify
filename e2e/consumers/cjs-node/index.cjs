const assert = require("node:assert/strict");

const {
  useDebouncedValue,
  useMediaQuery,
  useToggleState,
} = require("@altalyst/hookify");
const {
  installDocumentVisibility,
  installIntersectionObserver,
  installMatchMedia,
} = require("@altalyst/hookify/testing");
const { createElement } = require("react");
const { renderToString } = require("react-dom/server");

const Probe = () => {
  const [on] = useToggleState(true);
  const debounced = useDebouncedValue("value", 100);
  const matches = useMediaQuery("(min-width: 1px)", { defaultValue: false });
  return createElement("p", null, `${on}:${debounced}:${matches}`);
};

assert.equal(renderToString(createElement(Probe)), "<p>true:value:false</p>");
console.log("CommonJS require renders on the server");

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
console.log("CommonJS require of the testing helpers works");

// `matchMedia` is installed on `globalThis` too, so it works without a DOM.
const media = installMatchMedia();
const changes = [];
globalThis
  .matchMedia("(min-width: 600px)")
  .addEventListener("change", (event) => changes.push(event.matches));
media.setMatches("(min-width: 600px)", true);
media.restore();

assert.deepEqual(changes, [true]);
assert.equal(typeof globalThis.matchMedia, "undefined");

// The document helper needs a DOM, and says so.
assert.throws(() => installDocumentVisibility(), /needs a document/);
console.log("CommonJS require of the matchMedia and visibility helpers works");
