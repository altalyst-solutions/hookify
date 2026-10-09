---
"@altalyst/hookify": patch
---

Clean up the doc comments shipped in the type declarations so editor hovers and the API reference read cleanly: braced types are removed from `@param` and `@returns` (the signatures already carry them), `@template` becomes `@typeParam`, and code examples are tagged `tsx` or `ts`. The `useApi` example is now a proper fenced code block. No runtime or type changes.
