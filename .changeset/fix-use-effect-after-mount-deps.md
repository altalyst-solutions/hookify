---
"@altalyst/hookify": patch
---

Fix `useEffectAfterMount` running its callback on every re-render when `deps` was an inline array. It now compares the items in `deps` like `useEffect`, so the callback only runs after mount and when a dependency actually changes.
