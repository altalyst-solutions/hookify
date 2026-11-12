---
"@altalyst/hookify": minor
---

Add `useWebLock` hook, which runs async work under a named lock from the Web Locks API so only one tab (or any number, in `shared` mode) executes it at a time. It exposes `run`, `isHeld` and `isPending`, supports `mode`, `ifAvailable` and `steal` options with per-call overrides and an abort `signal`, aborts pending lock requests on unmount, and falls back to running the work directly when `navigator.locks` is unavailable.
