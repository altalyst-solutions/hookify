---
"@altalyst/hookify": patch
---

Use the default `GITHUB_TOKEN` for the release workflow now that branch protection only targets `main`, instead of a personal-account PAT. Release pull requests, commits, and tags will now be attributed to `github-actions[bot]`.
