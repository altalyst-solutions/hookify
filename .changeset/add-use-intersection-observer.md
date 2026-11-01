---
"@altalyst/hookify": minor
---

Add `useIntersectionObserver`, a hook that tracks whether an element is visible in the viewport or a scroll container using an `IntersectionObserver`. It returns `isIntersecting` and the raw `IntersectionObserverEntry` as state, with a stable callback `ref` that also works with conditionally rendered elements. It supports `root`, `rootMargin` and `threshold` (inline arrays are safe), an `onChange` callback for every raw entry, `once` for lazy-loading and reveal-once effects, `enabled` to pause, and `defaultIsIntersecting` for server rendering, and it is safe to use during server rendering.
