---
"@altalyst/hookify": minor
---

Add `useAsync`, a hook that runs any async function and tracks its `status`, `data` and `error`. It supports typed arguments, an optional `immediate` run on mount, `onSuccess` and `onError` callbacks and `initialData`. Only the latest run updates the state, `run` never rejects, and `run` and `reset` keep a stable identity.
