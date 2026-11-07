---
"@altalyst/hookify": minor
---

Deprecate `useDebounce` in favor of `useDebouncedCallback`, which takes the same arguments. `useDebounce` is now an alias of it, so a pending call runs the latest callback instead of the one captured when it was scheduled, the returned function keeps a stable identity, and it gains `cancel`, `flush` and `isPending`. The alias will be removed in a future release.
