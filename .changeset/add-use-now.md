---
"@altalyst/hookify": minor
---

Add `useNow` hook, which returns the current time in milliseconds and re-renders at a given interval. Every component with the same interval shares one timer, so many "5 min ago" labels cost a single `setInterval`; it starts with the first consumer and stops with the last. Ticks pause while the tab is hidden and refresh on return (`pauseWhenHidden`), `enabled: false` stops updating, and `serverNow` gives identical markup during server rendering and hydration. It is built on `useSyncExternalStore`, so it never tears and is safe under `StrictMode`.
