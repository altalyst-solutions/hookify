---
"@altalyst/hookify": minor
---

`useToggleState` now returns a third element, `setState`, for setting an explicit value such as `setOpen(false)`. Destructuring is unaffected, but code that annotates the result as `[boolean, () => void]`, or mocks it with a two-element tuple, needs the third element added.
