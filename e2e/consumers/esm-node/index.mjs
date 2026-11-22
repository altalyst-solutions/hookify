import assert from "node:assert/strict";

import {
  useDebouncedValue,
  useMediaQuery,
  useToggleState,
} from "@altalyst/hookify";
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
