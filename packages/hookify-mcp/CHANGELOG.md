# @altalyst/hookify-mcp

## 0.1.2

### Patch Changes

- [#136](https://github.com/altalyst-solutions/hookify/pull/136) [`b9d68ba`](https://github.com/altalyst-solutions/hookify/commit/b9d68ba85f49af5ece8e6de60fa15a4e482dc1da) Thanks [@sleepinzombie](https://github.com/sleepinzombie)! - The ES and CommonJS bundles now start with the `"use client"` directive, so React Server Component frameworks such as the Next.js App Router treat `@altalyst/hookify` as client code. Calling a hook from a Server Component now fails with a clear "is on the client" error instead of an obscure `useState is not a function` TypeError. Hooks still only run in Client Components, so put the components that call them in a file marked `"use client"`.

## 0.1.1

### Patch Changes

- [#130](https://github.com/altalyst-solutions/hookify/pull/130) [`6db327a`](https://github.com/altalyst-solutions/hookify/commit/6db327aa005d507af24580693051f9be16b41552) Thanks [@sleepinzombie](https://github.com/sleepinzombie)! - `get_hook` can now return every documented example when called with `includeAllExamples: true`.

## 0.1.0

### Minor Changes

- [#127](https://github.com/altalyst-solutions/hookify/pull/127) [`7bc9241`](https://github.com/altalyst-solutions/hookify/commit/7bc9241ba609d0a003d610d2bb27fea9041a83b1) Thanks [@sleepinzombie](https://github.com/sleepinzombie)! - First release of `@altalyst/hookify-mcp`, an MCP server that gives AI coding agents accurate, version-matched docs for `@altalyst/hookify`, so they use the real API instead of guessing it. Add it to your agent with `npx -y @altalyst/hookify-mcp` (for example `claude mcp add hookify -- npx -y @altalyst/hookify-mcp`). It offers three read-only tools: `list_hooks` lists every hook in a line each, grouped by category; `get_hook` returns a hook's signature, parameters, option and return types with defaults, use cases, behavior details and an example; and `find_hook` recommends hooks for a problem described in plain language, such as "debounce a search input", with the use case each one fits. It runs locally over stdio, makes no network requests, needs Node.js 22 or later, and starts every response with a note when your project has a different `@altalyst/hookify` version installed than the one its docs describe.
