---
"@altalyst/hookify": minor
---

Add `useIsomorphicLayoutEffect`, a drop-in replacement for `useLayoutEffect` that falls back to `useEffect` where there is no DOM, avoiding the server-rendering warning in React 18.
