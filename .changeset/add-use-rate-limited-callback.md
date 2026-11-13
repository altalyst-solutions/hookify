---
"@altalyst/hookify": minor
---

Add `useRateLimitedCallback` hook, which returns a stable function that runs a callback at most `limit` times per `windowMs` using a token bucket, so bursts are allowed but the average rate is capped. Excess calls are dropped (default) or queued and run in order as tokens refill (`overflow: "queue"`, with an optional `maxQueue`), `onLimited` receives dropped calls, and the function reports whether a call ran or was queued. It also exposes `cancel`, `remaining` and `pending`, always runs the latest callback and options, and clears its queue and timer on unmount.
