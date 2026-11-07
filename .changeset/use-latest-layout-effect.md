---
"@altalyst/hookify": patch
---

`useLatest` now updates its ref in a layout effect, so callbacks read from effects, including those of child components, always see the latest value. Hooks that kept their own copy of this pattern now use the shared `useLatest`.
