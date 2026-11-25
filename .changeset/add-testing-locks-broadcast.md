---
"@altalyst/hookify": minor
"@altalyst/hookify-mcp": patch
---

`@altalyst/hookify/testing` now also fakes the Web Locks API and `BroadcastChannel`, so components that use `useWebLock` or `useTabLeader` can be tested. `installWebLocks()` replaces `navigator.locks` with an in-memory lock manager that follows the real queueing rules: requests are granted in order per name, shared locks run together, `ifAvailable`, `steal` and an abort `signal` work, and invalid option combinations reject. Its controller lists the `held` and `pending` locks and every `request`, `hold(name, mode)` takes a lock as another tab would and returns a `release()`, `releaseAll()` frees locks, and `failNext()` makes the next request reject. `installBroadcastChannel()` replaces `BroadcastChannel` with a fake that delivers structured clones to other open channels with the same name, never back to the sender. `peer(name)` returns a stand-in for another tab that can `post()` messages and records what it `received`. Both return a controller with `restore()`.
