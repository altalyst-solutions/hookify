<div align="center">
  <img src="https://raw.githubusercontent.com/altalyst-solutions/hookify/main/docs-site/static/img/logo.svg" alt="Hookify logo" width="120" height="120" />

  <h1>Hookify</h1>

  <p><strong>A collection of framework-agnostic React hooks that just work.</strong></p>

  <p>
    <a href="https://www.npmjs.com/package/@altalyst/hookify"><img src="https://img.shields.io/npm/v/@altalyst/hookify.svg?color=3ECC5F" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/@altalyst/hookify"><img src="https://img.shields.io/npm/dm/@altalyst/hookify.svg?color=3ECC5F" alt="npm downloads" /></a>
    <a href="https://bundlephobia.com/package/@altalyst/hookify"><img src="https://img.shields.io/bundlephobia/minzip/@altalyst/hookify?color=3ECC5F" alt="bundle size" /></a>
    <a href="https://github.com/altalyst-solutions/hookify/actions/workflows/pr-check.yml"><img src="https://github.com/altalyst-solutions/hookify/actions/workflows/pr-check.yml/badge.svg" alt="PR Check status" /></a>
    <img src="https://img.shields.io/npm/types/@altalyst/hookify.svg?color=3178C6" alt="TypeScript" />
    <a href="https://github.com/altalyst-solutions/hookify/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
    <a href="https://github.com/altalyst-solutions/hookify/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@altalyst/hookify.svg?color=blue" alt="MIT license" /></a>
  </p>

  <p>
    <a href="https://altalyst-solutions.github.io/hookify/getting-started">Documentation</a> ·
    <a href="https://altalyst-solutions.github.io/hookify/hooks">Hook demos</a> ·
    <a href="https://altalyst-solutions.github.io/hookify/api">API reference</a> ·
    <a href="https://github.com/altalyst-solutions/hookify/discussions">Discussions</a>
  </p>
</div>

---

Hookify is a lightweight, dependency-free collection of React hooks for
everyday problems: debouncing, data fetching, toggling state, syncing state to
storage, detecting outside clicks, and more. Every hook is written in
TypeScript, fully typed, tree-shakeable, and documented with a live, editable
demo.

## Features

- 🌐 **SSR-safe** — hooks never touch `window`, `document` or `navigator`
  during render, so they work with Next.js, Remix and other server renderers
  without hydration warnings.
- 🧭 **Server Components aware** — the bundles start with `"use client"`, so
  React Server Component frameworks such as the Next.js App Router treat
  hookify as client code and give a clear error if a hook is called from a
  Server Component.
- 🧹 **Safe by default** — timers, listeners and observers are cleaned up on
  unmount and when inputs change, and hooks behave correctly under
  `StrictMode`.
- 🔁 **No stale closures** — callbacks and options can change between renders
  without resubscribing or resetting state.
- 📦 **Tiny and tree-shakeable** — import only what you use; no runtime
  dependencies beyond React. Ships ESM and CommonJS builds.
- 🔒 **Fully typed** — written in TypeScript with generated `.d.ts` files
  included.
- ⚡ **Zero config** — works with any React 18 or 19 project (CRA, Vite,
  Next.js, Remix, etc.).

## Installation

Hookify has `react` and `react-dom` as peer dependencies (v18+).

```bash
npm install @altalyst/hookify
```

```bash
yarn add @altalyst/hookify
```

```bash
pnpm add @altalyst/hookify
```

## Quick start

Import any hook directly from the package root:

```tsx
import { useToggleState } from "@altalyst/hookify";

export const Example = () => {
  const [isVisible, toggleVisibility] = useToggleState(false);

  return (
    <div>
      <button onClick={toggleVisibility}>
        {isVisible ? "Hide" : "Show"} content
      </button>
      {isVisible && <p>This is some toggleable content!</p>}
    </div>
  );
};
```

## Documentation

Hookify covers state, timing, async data, DOM observers, browser APIs, and
multi-tab coordination. The
**[hooks documentation](https://altalyst-solutions.github.io/hookify/hooks)**
lists every hook, with a live, editable demo and the full API of each one.
Guides and the generated API reference live in the
[docs site](https://altalyst-solutions.github.io/hookify/getting-started).

These docs match the latest release on npm. To see hooks and changes that are
on `main` but not yet released, browse the
[unreleased docs](https://altalyst-solutions.github.io/hookify/next/hooks); the
version menu in the top right switches between the two.

`useDebounce` and `useThrottle` are deprecated aliases of `useDebouncedCallback`
and `useThrottledValue`, kept for compatibility and due to be removed in a future
release.

## Using hookify with AI agents

[`@altalyst/hookify-mcp`](https://www.npmjs.com/package/@altalyst/hookify-mcp)
is an MCP server that gives AI coding agents such as Claude Code, Cursor and VS
Code accurate, version-matched docs for every hook, so they use the real API
instead of guessing it. It runs locally and makes no network requests:

```bash
claude mcp add hookify -- npx -y @altalyst/hookify-mcp
```

Setup for other clients, and what the server offers, is in its
[README](https://github.com/altalyst-solutions/hookify/tree/main/packages/hookify-mcp#readme).

## Contributing

Contributions, issues, and feature requests are welcome! See
[CONTRIBUTING.md](https://github.com/altalyst-solutions/hookify/blob/main/CONTRIBUTING.md) for local setup, running tests and the
docs site, how to add a new hook, and our commit/versioning conventions. Please also read our
[Code of Conduct](https://github.com/altalyst-solutions/hookify/blob/main/CODE_OF_CONDUCT.md). See [CHANGELOG.md](https://github.com/altalyst-solutions/hookify/blob/main/packages/hookify/CHANGELOG.md)
for release history.

## Community

- 💬 [GitHub Discussions](https://github.com/altalyst-solutions/hookify/discussions) — ask questions, share ideas.
- 🐛 [Issues](https://github.com/altalyst-solutions/hookify/issues) — report bugs or request features.
- 🔒 [Security policy](https://github.com/altalyst-solutions/hookify/blob/main/SECURITY.md) — how to report a vulnerability.
- 📦 [npm](https://www.npmjs.com/package/@altalyst/hookify) — package page and version history.

## License

MIT © [Altalyst Solutions](https://github.com/altalyst-solutions). See
[LICENSE](https://github.com/altalyst-solutions/hookify/blob/main/LICENSE) for details.

---

<div align="center">
  Built with ❤️ by <a href="https://github.com/altalyst-solutions">Altalyst Solutions</a>
</div>
