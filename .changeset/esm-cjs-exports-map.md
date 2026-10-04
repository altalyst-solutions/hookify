---
"@altalyst/hookify": minor
---

Improve package output for bundlers and Node. The UMD build (`hookify.umd.cjs`) is replaced by a CommonJS build (`hookify.cjs`) alongside the ES module build, a `.d.cts` types file is now shipped for CommonJS consumers, and an `exports` map plus `"sideEffects": false` are added so unused hooks are reliably tree-shaken. Script-tag usage via the global `hookify` is no longer available; use an ESM CDN or an import map instead.
