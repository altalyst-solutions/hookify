---
"@altalyst/hookify": minor
---

Add `useMediaQuery` hook, which subscribes to a CSS media query and returns whether it matches. It is hydration-safe via `useSyncExternalStore`, supports a `defaultValue` for the server and an `onChange` callback, and falls back gracefully when `matchMedia` is unavailable.
