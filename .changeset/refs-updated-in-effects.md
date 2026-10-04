---
"@altalyst/hookify": patch
---

Stop writing to or reading refs during render in `useMounted`, `useControlledState` and `useAutofillSubmit`, and stop setting state synchronously inside an effect in `useApi`, so the hooks are safe under concurrent rendering and the React Compiler. Behaviour is otherwise unchanged; `useApi` now also resets to `loading` immediately when the URL or options change.

`useApi` also no longer refetches in a loop when `headers` is passed as an inline object; headers are now compared by value.
