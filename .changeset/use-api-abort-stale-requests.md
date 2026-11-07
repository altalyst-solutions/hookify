---
"@altalyst/hookify": minor
---

`useApi` now aborts the request in flight through an `AbortSignal` when its inputs change, `refetch` is called again, or the component unmounts, and only the latest request can update the state, so a slow, outdated response can no longer overwrite a newer one. `204` and `205` responses resolve to `null` instead of failing to parse, the `PATCH` method is accepted, and `UseApiOptions` and `UseApiReturn` are now exported. Because `fetch` now receives a `signal`, tests that assert the exact `fetch` options should use `expect.objectContaining`.
