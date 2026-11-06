---
"@altalyst/hookify": patch
---

Resolve the `minimatch` denial-of-service advisory (GHSA-g3hv-75wg-m249) in development dependencies by overriding `minimatch` to `^11.0.1`. This only affects the repository's tooling; the published package has no runtime dependencies and its behavior is unchanged.
