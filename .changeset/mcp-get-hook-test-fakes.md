---
"@altalyst/hookify-mcp": patch
---

`get_hook` now lists the fakes from `@altalyst/hookify/testing` that a hook needs in a test, such as `installIntersectionObserver` for `useIntersectionObserver` or `installWebLocks` and `installBroadcastChannel` for `useTabLeader`, so an agent writing tests for a component that uses the hook reaches for the fake instead of writing a mock by hand.
