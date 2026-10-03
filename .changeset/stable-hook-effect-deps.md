---
"@altalyst/hookify": patch
---

Fix `react-hooks/exhaustive-deps` issues in `useApi` and `useMounted`. `useApi`'s `refetch` now keeps a stable identity until `url`, `method`, `headers`, or `body` change, and `useMounted` now calls the latest `onMount`/`onUnmount` callbacks instead of the ones from the first render.
