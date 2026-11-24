---
"@altalyst/hookify": minor
"@altalyst/hookify-mcp": patch
---

`@altalyst/hookify/testing` now also fakes `matchMedia` and the document's visibility. `installMatchMedia({ matches })` replaces `window.matchMedia`: `setMatches(query, matches)` changes a query and fires `change` on its lists, which support both `addEventListener` and the deprecated `addListener`. `installDocumentVisibility({ visibilityState })` controls `document.visibilityState` and `document.hidden`, and `setVisibility(state)` fires `visibilitychange`. Both expose `listenerCount`, `listenersAdded` and `listenersRemoved`, so a test can check that a component subscribes and cleans up, and both return a controller with `restore()`.
