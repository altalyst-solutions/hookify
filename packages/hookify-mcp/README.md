<div align="center">
  <img src="https://raw.githubusercontent.com/altalyst-solutions/hookify/main/docs-site/static/img/logo.svg" alt="Hookify logo" width="120" height="120" />

  <h1>Hookify MCP</h1>

  <p><strong>Accurate, version-matched docs for every <a href="https://www.npmjs.com/package/@altalyst/hookify">hookify</a> hook, right inside your AI coding agent.</strong></p>

  <p>
    <a href="https://www.npmjs.com/package/@altalyst/hookify-mcp"><img src="https://img.shields.io/npm/v/@altalyst/hookify-mcp.svg?color=3ECC5F" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/@altalyst/hookify-mcp"><img src="https://img.shields.io/npm/dm/@altalyst/hookify-mcp.svg?color=3ECC5F" alt="npm downloads" /></a>
    <img src="https://img.shields.io/node/v/@altalyst/hookify-mcp.svg?color=339933" alt="Node.js version" />
    <a href="https://registry.modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-registry-6E56CF.svg" alt="Listed on the MCP Registry" /></a>
    <a href="https://github.com/altalyst-solutions/hookify/actions/workflows/pr-check.yml"><img src="https://github.com/altalyst-solutions/hookify/actions/workflows/pr-check.yml/badge.svg" alt="PR Check status" /></a>
    <a href="https://github.com/altalyst-solutions/hookify/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@altalyst/hookify-mcp.svg?color=blue" alt="MIT license" /></a>
  </p>

  <p>
    <a href="#set-it-up">Set it up</a> ·
    <a href="https://altalyst-solutions.github.io/hookify/hooks">Hook demos</a> ·
    <a href="https://github.com/altalyst-solutions/hookify/blob/main/packages/hookify-mcp/CHANGELOG.md">Changelog</a> ·
    <a href="https://github.com/altalyst-solutions/hookify/discussions">Discussions</a>
  </p>
</div>

---

AI coding agents often guess the API of libraries they haven't seen much of.
`@altalyst/hookify-mcp` is an [MCP](https://modelcontextprotocol.io) server
that gives them the real one for
[`@altalyst/hookify`](https://www.npmjs.com/package/@altalyst/hookify): every
hook's signature, options with their defaults, use cases and an example, plus
recommendations for the problem you describe.

- **Accurate:** built from the library's published types and docs, never
  hand-written.
- **Version-matched:** released with every hookify release, and it tells your
  agent when your project uses a different hookify version.
- **Local and private:** runs on your machine over stdio, makes no network
  requests, needs no API key.

```bash
claude mcp add hookify -- npx -y @altalyst/hookify-mcp
```

## What it looks like

You ask your agent something like _"debounce this search input with
hookify"_. It calls `find_hook`, which answers:

```text
Hooks for "debounce a search input", best first:

1. useDebouncedValue (best match): Returns a copy of a value that only updates
   once it stops changing for a delay, such as a search term after the user
   stops typing.
   Fits: Running a search or fetch only once the user stops typing.

2. useDebouncedCallback (good match): Returns a stable debounced function with
   cancel, flush and isPending controls and optional leading or trailing calls.
   Fits: Searching or validating as the user types, with Enter to run
   immediately and Esc to cancel.

Call get_hook with "useDebouncedValue" for its signature, options and an example.
```

Then it calls `get_hook` for `useDebouncedValue` and writes code against its
real signature, `useDebouncedValue<T>(value: T, delay: number): T`.

## Tools

| Tool         | What your agent gets                                                                                                                                                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_hooks` | Every hook in one line, grouped by category. Optional `category` and `includeDeprecated`.                                                                                                                                                                                                       |
| `get_hook`   | One hook's signature, parameters, option and return types with their defaults, use cases, behavior details and the test fakes from `@altalyst/hookify/testing` that fake its browser APIs. Set `includeAllExamples: true` to include every documented example; by default it returns the first. |
| `find_hook`  | The best hooks for a problem described in plain language, with the use case each one fits. Optional `limit` (1 to 10).                                                                                                                                                                          |

All three are read-only. When the project your agent works in has a different
`@altalyst/hookify` version installed than the one the data describes, every
response starts with a note saying which versions differ.

## Set it up

Requires Node.js 22 or later. CI tests the server on Node.js 22 and 24.

<details open>
<summary><strong>Claude Code</strong></summary>

```bash
claude mcp add hookify -- npx -y @altalyst/hookify-mcp
```

</details>

<details>
<summary><strong>Cursor, Claude Desktop and other clients that use <code>mcpServers</code></strong></summary>

Add this to your client's MCP configuration, for example `.cursor/mcp.json` in
your project for Cursor:

```json
{
  "mcpServers": {
    "hookify": { "command": "npx", "args": ["-y", "@altalyst/hookify-mcp"] }
  }
}
```

</details>

<details>
<summary><strong>VS Code</strong></summary>

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

</details>

The server is also listed on the
[MCP Registry](https://registry.modelcontextprotocol.io) as
`io.github.altalyst-solutions/hookify`, so clients that browse the registry
can install it from there.

## Versions

Each release describes one release of `@altalyst/hookify`, and `list_hooks`
and `get_hook` say which. To match an older hookify exactly, pin the server
release that describes it, for example `npx -y @altalyst/hookify-mcp@0.1.0`.
The [changelog](https://github.com/altalyst-solutions/hookify/blob/main/packages/hookify-mcp/CHANGELOG.md)
lists every release.

## Troubleshooting

- **The agent doesn't see the tools.** Restart the client after adding the
  server, and check its MCP or server log for errors.
- **`npx` fails or is slow the first time.** The first run downloads the
  package; later runs use npm's cache. If your npm points at a private
  registry, make sure it can reach `@altalyst/hookify-mcp` on npmjs.com.
- **`Unsupported engine` or a syntax error on start.** Upgrade to Node.js 22
  or later.

## Development

The hook data (`src/generated/hooks.json`) is generated at build time by
`scripts/build-data.ts`, from the library's bundled type definitions and the
docs site's hook pages. From the repository root:

```bash
pnpm build      # the library, then this server
pnpm test:mcp   # tests, including the find_hook golden queries
npx @modelcontextprotocol/inspector node packages/hookify-mcp/dist/bin.js
```

See [CONTRIBUTING.md](https://github.com/altalyst-solutions/hookify/blob/main/CONTRIBUTING.md)
for the full workflow.

## License

MIT © [Altalyst Solutions](https://github.com/altalyst-solutions)
