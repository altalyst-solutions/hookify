---
"@altalyst/hookify": minor
---

Add `useTimeout`, a declarative `setTimeout` hook. It always calls the latest callback, pauses when the delay is `null`, clears itself on unmount, and returns stable `start`, `cancel` and `isPending` controls, with an `autoStart: false` option to start the timer on demand.
