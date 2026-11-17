---
title: AI agents (MCP)
description: Give Claude Code, Cursor, VS Code and other AI coding agents accurate, version-matched docs for every hookify hook with the hookify MCP server.
slug: /ai-agents
---

# AI agents (MCP)

AI coding agents often guess the API of libraries they haven't seen much of.
[`@altalyst/hookify-mcp`](https://www.npmjs.com/package/@altalyst/hookify-mcp)
is an [MCP](https://modelcontextprotocol.io) server that gives them the real
one: every hook's signature, options with their defaults, use cases and an
example, taken from the same types and docs as this site.

It runs on your machine over stdio, only reads data bundled in the package,
makes no network requests and needs no API key. It requires Node.js 22 or
later.

## Set it up

### Claude Code

```bash
claude mcp add hookify -- npx -y @altalyst/hookify-mcp
```

### Cursor, Claude Desktop and other clients that use `mcpServers`

Add this to your client's MCP configuration, for example `.cursor/mcp.json` in
your project for Cursor:

```json
{
  "mcpServers": {
    "hookify": { "command": "npx", "args": ["-y", "@altalyst/hookify-mcp"] }
  }
}
```

### VS Code

Add this to `.vscode/mcp.json` in your project:

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

The server is also listed on the
[MCP Registry](https://registry.modelcontextprotocol.io) as
`io.github.altalyst-solutions/hookify`, so clients that browse the registry
can install it from there.

## What it offers

| Tool         | What your agent gets                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `list_hooks` | Every hook in one line, grouped by category (state, timing, async, DOM, browser, lifecycle, refs).                         |
| `get_hook`   | One hook's signature, parameters, option and return types with their defaults, use cases, behavior details and an example. |
| `find_hook`  | The best hooks for a problem described in plain language, with the use case each one fits.                                 |

You don't call these yourself; your agent picks them when it needs to. Prompts
like these lead it there:

- "Which hookify hook should I use to debounce this search input?"
- "Close this dropdown when the user clicks outside it, using hookify."
- "Only one browser tab should poll this endpoint. Is there a hook for that?"
- "What options does `useRateLimitedCallback` take?"

## Versions

Each release of the server describes one release of `@altalyst/hookify`, and a
new server release follows every library release. When the project your agent
works in has a different hookify version installed, every response starts with
a note saying which versions differ, so the agent knows to double-check.

To match an older hookify exactly, pin the server release that describes it,
for example `npx -y @altalyst/hookify-mcp@0.1.0`. The server reports the
hookify version it describes in its answers: `list_hooks` starts with it, and
`get_hook` shows it next to the import. Its
[changelog](https://github.com/altalyst-solutions/hookify/blob/main/packages/hookify-mcp/CHANGELOG.md)
lists every release.

## Troubleshooting

- **The agent doesn't see the tools.** Restart the client after adding the
  server, and check its MCP or server log for errors.
- **`npx` fails or is slow the first time.** The first run downloads the
  package; later runs use npm's cache. If your npm points at a private
  registry, make sure it can reach `@altalyst/hookify-mcp` on npmjs.com.
- **`Unsupported engine` or a syntax error on start.** Upgrade to Node.js 22
  or later.
