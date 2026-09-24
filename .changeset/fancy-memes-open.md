---
"@altalyst/hookify": patch
---

Fix release automation so published versions correctly get a git tag and GitHub release. `changesets/action@v1` detected releases by matching a CLI output string that `@changesets/cli@3.0.3` no longer prints, silently skipping the tag/release step; upgrading to `changesets/action@v2` fixes this.
