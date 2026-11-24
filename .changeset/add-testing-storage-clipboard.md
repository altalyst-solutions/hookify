---
"@altalyst/hookify": minor
"@altalyst/hookify-mcp": patch
---

`@altalyst/hookify/testing` now also fakes web storage and the clipboard. `createMemoryStorage()` is an in-memory `Storage` that can enforce a `quota` and throw a real `QuotaExceededError`; `installLocalStorage()` and `installSessionStorage()` put one on the window, and can make the global throw a `SecurityError` as when storage is blocked. `dispatchStorageEvent(key, newValue, storage)` simulates another tab changing storage, so cross-tab sync can be tested without writing events by hand. `installClipboard()` replaces `navigator.clipboard`, records what was written, can deny permission with a `NotAllowedError`, and can fail or hold calls in flight with `failNext()` and `deferNext()`.
