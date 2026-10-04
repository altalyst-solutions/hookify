---
"@altalyst/hookify": minor
---

Add `useAutofillSubmit`, a hook that submits a form as soon as a password manager fills it. It is fully typed (field names are inferred as literals) and configurable through `enabled`, `pollInterval`, `interactionEvents`, `requireInteraction`, `isFilled`, `onAutofill` (can veto) and `submit`, and returns `rearm`, `disarm` and `isArmed` controls.
