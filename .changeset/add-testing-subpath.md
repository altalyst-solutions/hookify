---
"@altalyst/hookify": minor
"@altalyst/hookify-mcp": patch
---

Adds `@altalyst/hookify/testing`, a separate entry with test helpers that don't depend on any test runner. It starts with fakes for `IntersectionObserver` and `ResizeObserver`, which jsdom doesn't implement: `installIntersectionObserver()` and `installResizeObserver()` put a fake on the global and return a controller to `trigger()` entries, inspect the observers that were created, and `restore()` the global. `createIntersectionObserverEntry()` and `createResizeObserverEntry()` build entries for tests. The main `@altalyst/hookify` bundle is unchanged.
