import assert from "node:assert/strict";
import { readdirSync } from "node:fs";

const assets = readdirSync("dist/assets");

assert.ok(
  assets.some((file) => file.endsWith(".js")),
  "The production build should emit a JavaScript bundle"
);
console.log("Vite production build emitted", assets.join(", "));
