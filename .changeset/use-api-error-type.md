---
"@altalyst/hookify": minor
---

Breaking: `useApi` now reports `error` as an `Error | null` instead of a `string | null`. A non-2xx response is reported as the new exported `ApiError`, which carries the `status` and the unread `response`, and network or JSON parse failures are reported as the original `Error`. The message for a failed status changed from `"Error: 404"` to `"Request failed with status 404"`. To migrate, render `error.message` instead of `error`, and check `error instanceof ApiError && error.status === 404` instead of parsing the string.
