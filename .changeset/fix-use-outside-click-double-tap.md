---
"@altalyst/hookify": patch
---

Fix `useOutsideClick` calling the callback twice for a single tap on touch screens (once for `touchstart` and again for the emulated `click`). It also calls the latest callback without re-subscribing its listeners on every render.
