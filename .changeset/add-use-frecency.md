---
"@altalyst/hookify": minor
---

Add `useFrecency` hook, which ranks items by how often and how recently they were used, for command palettes, recent items and suggestions. `record` counts a use, `rank` sorts a list of ids with the most used and most recent first, `score` reads one score, and `remove` and `clear` forget items. Scores decay exponentially with a configurable `halfLifeMs`, the least used items are dropped past `maxItems`, a custom `now` makes tests deterministic, and `storage` picks where the scores are kept. They are saved through `usePersistedState`, so they survive reloads and stay in sync across tabs, and corrupt or missing storage starts empty.
