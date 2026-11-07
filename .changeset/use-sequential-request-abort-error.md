---
"@altalyst/hookify": minor
---

Breaking: a canceled `useSequentialRequest` call now rejects with a standard `AbortError` (a `DOMException`, also passed to the signal as its `reason`) instead of `new Error("CanceledError")`. To migrate, replace `error.message !== "CanceledError"` checks with `!isAbortError(error)`, using the new exported `isAbortError` helper, which also recognizes the `AbortError` that `fetch` throws.
