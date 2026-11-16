---
"@altalyst/hookify-mcp": minor
---

First release of `@altalyst/hookify-mcp`, an MCP server that gives AI coding agents accurate, version-matched docs for `@altalyst/hookify`, so they use the real API instead of guessing it. Add it to your agent with `npx -y @altalyst/hookify-mcp` (for example `claude mcp add hookify -- npx -y @altalyst/hookify-mcp`). It offers three read-only tools: `list_hooks` lists every hook in a line each, grouped by category; `get_hook` returns a hook's signature, parameters, option and return types with defaults, use cases, behavior details and an example; and `find_hook` recommends hooks for a problem described in plain language, such as "debounce a search input", with the use case each one fits. It runs locally over stdio, makes no network requests, needs Node.js 22 or later, and starts every response with a note when your project has a different `@altalyst/hookify` version installed than the one its docs describe.
