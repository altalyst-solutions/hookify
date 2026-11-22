const assert = require("node:assert/strict");

const {
  useDebouncedValue,
  useMediaQuery,
  useToggleState,
} = require("@altalyst/hookify");
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
