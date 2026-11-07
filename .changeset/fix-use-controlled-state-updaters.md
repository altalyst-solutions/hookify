---
"@altalyst/hookify": patch
---

Fix `useControlledState` dropping updates when an updater is called several times in one event: in uncontrolled mode, `setValue(n => n + 1)` twice now adds 2 instead of 1. `setValue` also keeps a stable identity and always calls the latest `onChange`.
