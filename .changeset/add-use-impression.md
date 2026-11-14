---
"@altalyst/hookify": minor
---

Add `useImpression` hook, which calls a callback once an element has been at least `threshold` visible for at least `minDurationMs`, for analytics, "mark as read" and ad-view tracking. Leaving the viewport before the time is up resets the timer, and time in a hidden tab does not count. It reports once per element by default (`once: false` reports again after the element leaves and re-enters), supports `root`, `rootMargin` and `enabled`, always calls the latest callback without re-observing, never re-renders your component, and does nothing on the server or where `IntersectionObserver` is unavailable.
