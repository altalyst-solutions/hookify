# @altalyst/hookify-mcp

An [MCP](https://modelcontextprotocol.io) server that gives AI coding agents
accurate, version-matched docs for the
[`@altalyst/hookify`](https://www.npmjs.com/package/@altalyst/hookify) React
hooks, so they use the real API instead of guessing it.

It runs locally over stdio, only reads data bundled in the package, and makes
no network requests. It needs Node.js 22 or later, and CI tests it on Node.js
22 and 24.

## Tools

| Tool         | What it does                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| `list_hooks` | Lists every hook in one line each, grouped by category. Optional `category` and `includeDeprecated`.                |
| `get_hook`   | Returns one hook's signature, parameters, option and return types with defaults, use cases, details and an example. |
| `find_hook`  | Recommends hooks for a problem in plain language, such as "debounce a search input", with the use case each fits.   |

When the project the agent works in has a different `@altalyst/hookify`
version installed than the one the data describes, every response starts with
a note saying so.

## Setup

**Claude Code**

```bash
claude mcp add hookify -- npx -y @altalyst/hookify-mcp
```

**Claude Desktop, Cursor (`.cursor/mcp.json`) and other clients using `mcpServers`**

```json
{
  "mcpServers": {
    "hookify": { "command": "npx", "args": ["-y", "@altalyst/hookify-mcp"] }
  }
}
```

**VS Code (`.vscode/mcp.json`)**

```json
{
  "servers": {
    "hookify": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@altalyst/hookify-mcp"]
    }
  }
}
```

## Development

The hook data (`src/generated/hooks.json`) is generated at build time from the
library's bundled type definitions and the docs site's hook pages, by
`scripts/build-data.ts`. From the repository root:

```bash
pnpm build                                  # the library, then this server
pnpm test:mcp                               # tests, including the find_hook golden queries
npx @modelcontextprotocol/inspector node packages/hookify-mcp/dist/bin.js
```

## License

MIT © [Altalyst Solutions](https://github.com/altalyst-solutions)
