<div align="center">
  <img src="docs-site/static/img/logo.svg" alt="Hookify logo" width="120" height="120" />

  <h1>Hookify</h1>

  <p><strong>A collection of framework-agnostic React hooks that just work.</strong></p>

  <p>
    <a href="https://www.npmjs.com/package/@altalyst/hookify"><img src="https://img.shields.io/npm/v/@altalyst/hookify.svg?color=3ECC5F" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/@altalyst/hookify"><img src="https://img.shields.io/npm/dm/@altalyst/hookify.svg?color=3ECC5F" alt="npm downloads" /></a>
    <a href="https://bundlephobia.com/package/@altalyst/hookify"><img src="https://img.shields.io/bundlephobia/minzip/@altalyst/hookify?color=3ECC5F" alt="bundle size" /></a>
    <a href="https://github.com/altalyst-solutions/hookify/actions/workflows/pr-check.yml"><img src="https://github.com/altalyst-solutions/hookify/actions/workflows/pr-check.yml/badge.svg" alt="PR Check status" /></a>
    <img src="https://img.shields.io/npm/types/@altalyst/hookify.svg?color=3178C6" alt="TypeScript" />
    <a href="https://github.com/altalyst-solutions/hookify/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/npm/l/@altalyst/hookify.svg?color=blue" alt="MIT license" /></a>
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

## Table of contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Available hooks](#available-hooks)
- [Documentation](#documentation)
- [Local development](#local-development)
- [Contributing](#contributing)
- [Community](#community)
- [License](#license)

## Features

- 🪝 **Ten focused hooks** covering the most common React state, effect, and
  side-effect patterns.
- 📦 **Tiny and tree-shakeable** — import only what you use; no runtime
  dependencies beyond React.
- 🔒 **Fully typed** — written in TypeScript with generated `.d.ts` files
  included.
- ⚡ **Zero config** — works out of the box with any React 18+ project (CRA,
  Vite, Next.js, Remix, etc.).
- 📚 **Live docs** — every hook has a runnable, editable demo and full API
  reference generated straight from the source.

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

## Available hooks

| Hook                                                                                                | Description                                                                                  |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [`useApi`](https://altalyst-solutions.github.io/hookify/hooks/use-api)                              | Declarative hook for making HTTP requests with built-in loading, error, and data state.      |
| [`useControlledState`](https://altalyst-solutions.github.io/hookify/hooks/use-controlled-state)     | Manage a value that works in both controlled and uncontrolled modes, like native inputs.     |
| [`useDebounce`](https://altalyst-solutions.github.io/hookify/hooks/use-debounce)                    | Debounce a callback so it only runs after a delay has passed since its last invocation.      |
| [`useDocVisible`](https://altalyst-solutions.github.io/hookify/hooks/use-doc-visible)               | Track whether the current document/tab is visible via the Page Visibility API.               |
| [`useEffectAfterMount`](https://altalyst-solutions.github.io/hookify/hooks/use-effect-after-mount)  | Run an effect only after the initial mount, skipping the first render.                       |
| [`useMounted`](https://altalyst-solutions.github.io/hookify/hooks/use-mounted)                      | Track whether a component is currently mounted to guard async state updates.                 |
| [`useOutsideClick`](https://altalyst-solutions.github.io/hookify/hooks/use-outside-click)           | Fire a callback when a click or touch happens outside a given element.                       |
| [`usePersistedState`](https://altalyst-solutions.github.io/hookify/hooks/use-persisted-state)       | Persist state to `localStorage` and sync it across browser tabs.                             |
| [`useSequentialRequest`](https://altalyst-solutions.github.io/hookify/hooks/use-sequential-request) | Ensure only the latest of several in-flight async requests resolves; stale ones are ignored. |
| [`useToggleState`](https://altalyst-solutions.github.io/hookify/hooks/use-toggle-state)             | Toggle a boolean state with a simple, memoized setter.                                       |

Browse the [hooks documentation](https://altalyst-solutions.github.io/hookify/hooks)
for live, editable demos and the full API of each hook.

## Documentation

Full guides, live demos, and the generated API reference live at
**[altalyst-solutions.github.io/hookify](https://altalyst-solutions.github.io/hookify/getting-started)**.

## Local development

```bash
# Install library dependencies
npm run setup

# Run the test suite
npm test

# Lint and format
npm run lint
npm run format

# Build the library
npm run build
```

To preview documentation changes locally (including new hooks) without
waiting for a deploy:

```bash
npm run docs:install   # first time only
npm run docs:dev       # starts Docusaurus with hot reload at localhost:3000
```

## Contributing

Contributions, issues, and feature requests are welcome! See
[CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, how to add a new hook,
and our commit/versioning conventions. Please also read our
[Code of Conduct](./CODE_OF_CONDUCT.md). See [CHANGELOG.md](./CHANGELOG.md)
for release history.

## Community

- 💬 [GitHub Discussions](https://github.com/altalyst-solutions/hookify/discussions) — ask questions, share ideas.
- 🐛 [Issues](https://github.com/altalyst-solutions/hookify/issues) — report bugs or request features.
- 🔒 [Security policy](./SECURITY.md) — how to report a vulnerability.
- 📦 [npm](https://www.npmjs.com/package/@altalyst/hookify) — package page and version history.

## License

MIT © [Altalyst Solutions](https://github.com/altalyst-solutions). See
[LICENSE](./LICENSE) for details.

---

<div align="center">
  Built with ❤️ by <a href="https://github.com/altalyst-solutions">Altalyst Solutions</a>
</div>
