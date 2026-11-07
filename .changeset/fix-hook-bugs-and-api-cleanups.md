---
"@altalyst/hookify": minor
---

Fix several hook bugs and tidy up the public API.

**Fixes**

- `useControlledState`: several updater calls in one event (`setValue(n => n + 1)` twice) now each build on the previous result in uncontrolled mode, instead of all reading the same stale value. `setValue` now keeps a stable identity and always calls the latest `onChange`.
- `usePersistedState`: changing `key` now loads the value stored under the new key (or `initialValue`) instead of writing the previous key's value over it. Removing the key or clearing storage in another tab now resets to `initialValue`, events from `sessionStorage` are ignored, and instances that share a key in the same tab stay in sync.
- `useOutsideClick`: a tap on a touch screen now fires the callback once instead of twice (`touchstart` plus the emulated `click`). The latest callback is used without re-subscribing on every render.
- `useApi`: requests are now aborted with an `AbortSignal` when the inputs change, `refetch` is called again, or the component unmounts, and only the latest request can update the state, so a slow, outdated response can no longer overwrite a newer one. `204` and `205` responses resolve to `null` instead of failing to parse.
- `useDebounce`: the pending call now runs the latest callback instead of the one captured when it was scheduled, and the returned function keeps a stable identity. It is now built on `useDebouncedCallback`.

**Improvements**

- `useToggleState` returns a third element, `setState`, for setting an explicit value.
- `useApi` accepts the `PATCH` method.
- `UseApiOptions`, `UseApiReturn`, `UseDocVisibleOptions` and `UseMountedOptions` are now exported.
- `useLatest` now updates its ref in a layout effect, so callbacks read from effects (including child effects) always see the latest value. Every hook now uses the shared `useLatest` instead of its own copy.
