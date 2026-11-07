---
"@altalyst/hookify": minor
---

`usePersistedState` accepts an optional third argument, `{ storage }`, to persist to `sessionStorage` or any object with `getItem` and `setItem` instead of `localStorage` (the default). Syncing across tabs and between instances in the same tab only links instances that use the same key and the same storage. When `localStorage` can't be accessed at all (for example when the browser blocks it), the value is now kept in memory without logging an error on every update. The `PersistedStateStorage` and `UsePersistedStateOptions` types are exported.
