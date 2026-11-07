---
"@altalyst/hookify": patch
---

Fix `usePersistedState` writing the previous value under a new key when `key` changes; it now loads the value stored under the new key, or `initialValue`. Removing the key or clearing storage in another tab now resets the value to `initialValue`, `sessionStorage` events are ignored, and instances that share a key in the same tab stay in sync.
