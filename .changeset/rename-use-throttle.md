---
"@altalyst/hookify": minor
---

Rename `useThrottle` to `useThrottledValue` (and `UseThrottleOptions` to `UseThrottledValueOptions`) so the name says it throttles a value, matching `useDebouncedValue` and `useDebouncedCallback`. The old names remain as deprecated aliases with the same behavior and will be removed in a future release.
