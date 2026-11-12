---
"@altalyst/hookify": minor
---

Add `useTabLeader` hook, which elects one browser tab as the leader among all tabs of the same origin, so polling, websockets or syncs run in a single tab. It exposes `isLeader`, `leaderId`, `id` and a `broadcast` function, supports `enabled`, `onElected`, `onDemoted` and `onMessage` options, hands leadership to another tab when the leader closes or crashes, and elects with Web Locks, falling back to a `BroadcastChannel` heartbeat and then to treating the page as a single tab.
