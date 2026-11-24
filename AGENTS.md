# Hookify agent guide

Hookify (`@altalyst/hookify`) is a library of React hooks. It supports **React
18.0.0 and later, including 19**, runs on Node >= 24, and has **no runtime
dependencies**. Follow this guide when changing code here; see
[CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor workflow.

## Layout

The repo is a pnpm workspace. The published library lives in
`packages/hookify/`; the root only holds shared tooling (ESLint, Prettier,
Changesets, CI).

```
packages/hookify/src/hooks/   one file per hook (use-kebab-case.ts), exported from src/hooks/index.ts
packages/hookify/src/utils/   internal helpers (dev-warnings.ts), not part of the public API
packages/hookify/src/testing/ test helpers (fakes for browser APIs), the separate `@altalyst/hookify/testing` entry; see below
packages/hookify/tests/hooks/ one spec per hook, mirrors src/hooks
packages/hookify/tests/testing/ one spec per test helper, mirrors src/testing
docs-site/docs/hooks/         one .mdx page per hook
docs-site/src/hook-examples/use-x/   live demo components (App.tsx plus one file per demo)
packages/hookify-mcp/         @altalyst/hookify-mcp, the MCP server for AI agents; see its README
.changeset/                   release notes, one file per user-visible change
```

In the rest of this guide, `src/` and `tests/` mean `packages/hookify/src/`
and `packages/hookify/tests/`.

## Commands

Run these from the repository root before finishing. CI (`.github/workflows/pr-check.yml`) runs the same.

```bash
pnpm format:check   # prettier
pnpm lint           # eslint, including TSDoc rules
pnpm typecheck      # tsc -b (src and tests)
pnpm typecheck:all  # builds, then type-checks the library, MCP server, docs site and e2e/consumers fixtures
pnpm coverage       # vitest with per-file coverage thresholds
pnpm build          # typecheck + vite build, then the MCP server
pnpm check:package  # after a build: publint and attw on the packed packages
pnpm size           # after a build: gzipped size of the bundle and of each hook against packages/hookify/size-budgets.json
pnpm size:update    # after a build: add budgets for new hooks, drop deleted ones; name a hook to raise its budget
pnpm test:consumers # after a build: install the packed library into the e2e/consumers fixtures
pnpm setup:consumers # once, after a build: install the fixtures' dependencies in place, linked to the library, so editors resolve their imports
```

`pnpm format` fixes formatting. To run a single spec: `pnpm -F @altalyst/hookify exec vitest run tests/hooks/use-x.spec.ts`.

When a change touches React behavior, also run the React 18 matrix CI uses.
pnpm has no `--no-save`, so each run edits `packages/hookify/package.json` and `pnpm-lock.yaml`
and then restores them. Restoring between runs matters: without it, `react@18`
reuses the 18.0.0 just installed. Never commit those edits:

```bash
for V in 18.0.0 18; do
  pnpm -F @altalyst/hookify add -D "react@$V" "react-dom@$V" "@types/react@${V%%.*}" "@types/react-dom@${V%%.*}"
  pnpm typecheck && pnpm test --run
  git checkout packages/hookify/package.json pnpm-lock.yaml && pnpm install
done
```

The MCP server builds its data from the library's bundled types and the hook
pages' front matter and "When to use it" sections, so a new or changed hook
reaches it automatically. If you add a hook, also add a query for it to
`GOLDEN_QUERIES` in `packages/hookify-mcp/tests/search.spec.ts`, and run
`pnpm build && pnpm test:mcp --run`.

If you touched docs, also run `pnpm docs:check && pnpm build && pnpm -F docs-site typecheck && pnpm docs:build`.

## Code style (`src/`)

- **Arrow functions only.** Every hook, helper and callback is a `const` arrow
  function (`export const useX = (...) => {}`). Never use `function`
  declarations or `export default` in `src/`. The one exception is a
  function that needs its own `this`, which should be avoided.
- **Named exports only.** Export a hook, its `Options`/`Return` types, and
  nothing else the consumer doesn't need. Re-export from `src/hooks/index.ts`
  (`export * from "./use-x";`, alphabetical, enforced by `simple-import-sort`).
- **Types:** use `interface` for object shapes (37 of the 49 exported types;
  a few older hooks use `type` for them, don't copy that) and `type` for
  unions and aliases. Name them `UseXOptions` and `UseXReturn` (or
  `UseXResult`). Avoid `any`; where it is genuinely needed
  (for example `T extends (...args: any[]) => void`), add an
  `eslint-disable-next-line` with a `--` reason.
- **Imports:** `react` first, then a blank line, then relative imports
  (`./use-latest`, `../utils`). Use `import type` for type-only imports.
  Formatting is Prettier (`printWidth` 80, double quotes, semicolons, ES5
  trailing commas), so never hand-format.
- **Stable callbacks and latest values:** use `useLatest` / `useStableCallback`
  and refs named `xRef` (`callbackRef`, `optionsRef`, `timerRef`) so changing
  a callback or option never resubscribes or resets state.
- **SSR safe:** never touch `window`, `document` or `navigator` during render.
  Guard with `typeof window === "undefined"` and read browser APIs in
  effects or subscriptions. Use `useIsomorphicLayoutEffect` instead of
  `useLayoutEffect`. For external stores use `useSyncExternalStore` with a
  `getServerSnapshot`.
- **Clean up everything:** timers, listeners, observers and subscriptions are
  removed on unmount and when inputs change. Hooks must behave under
  `StrictMode` (effects run twice) and must not run callbacks after unmount.
- **Dev-only diagnostics:** use `warnInDevelopment` / `errorInDevelopment` from
  `src/utils`, never `console.*` directly.
- **Dependencies:** do not add runtime dependencies.
- **Extensible, not over-engineered:** expose the options real consumers need
  (`enabled`, `onX` callbacks, an injectable target or storage), return
  stable references, and stop there. No speculative configuration.
- **`eslint-disable`:** only when unavoidable, always on the single line,
  and with a `--` reason explaining why.

## Test helpers (`src/testing/`)

`src/testing/` is a second public entry, published as `@altalyst/hookify/testing`
(`dist/testing.js`, `dist/testing.cjs`, and types in `dist/testing.d.ts` and
`dist/testing.d.cts`, with a `typesVersions` fallback for `node10` resolution).
It holds fakes for browser APIs that jsdom lacks, so consumers can test
components that use hookify.

- It is **never** imported by `src/index.ts` or any hook, so `dist/hookify.js`
  doesn't contain it, and it gets no `"use client"` banner.
- It has no dependency on a test runner or on React: no `vi`, `jest` or
  `@testing-library` imports. Fakes install themselves on `globalThis`, and
  `restore()` puts back what was there before (or deletes the global).
- Each `installX()` returns a controller with `restore()` and the methods that
  drive the fake: `instances`, `active` and `trigger(target, overrides)` for the
  observers, `setMatches(query, matches)` for `matchMedia`, and
  `setVisibility(state)` for the document. Fakes that add listeners also expose
  `listenerCount`, `listenersAdded` and `listenersRemoved`. Callers wrap the
  methods that fire events in `act()` themselves.
- The same style rules, TSDoc rules and per-file coverage thresholds as the
  hooks apply. Our own specs use the fakes, so a helper stays honest to what
  the hooks need.
- Name helpers `installX` for a fake that replaces a global and `createXEntry`
  for a value factory. Use `{@link ...}` and prose rather than `@throws`, which
  the jsdoc and tsdoc lint rules disagree on.

## Documentation style (TSDoc)

Everything in `src/` is documented, and `pnpm lint` enforces the syntax
(`eslint-plugin-jsdoc` + `eslint-plugin-tsdoc`), though not completeness. The
generated API reference is built from these comments, so write them for
consumers. The reference examples are `use-rate-limited-callback.ts`,
`use-tab-leader.ts` and `use-now.ts`; copy their style. Some older hooks
(`use-latest.ts`, `use-mounted.ts`, ...) are sparser, so don't treat them as
the bar.

- **Document every declaration with `/** */`:** exported hooks, every
  interface/type member, every module constant, every helper, and every
  non-trivial local `const`/`let`/ref inside a hook (what it holds and
  why). Single-line `/** ... */` is fine for short ones. Constants with units
  say so ("in milliseconds").
- **Use `//` only for the "why" of a block of logic** (a race, a browser quirk,
  a trade-off), not to describe a declaration. Declarations get `/** */`.
- **No types in braces.** Write `@param name - description`,
  `@returns description` and `@typeParam T - description`. Never
  `@param {string} name`, and use `@typeParam`, not `@template`.
- **Options interfaces:** open with `/** Options for {@link useX}. */`.
  Document each member, including the default as the last sentence
  (`Default is \`true\`.`) and what happens at edge values.
- **Exported hook doc, in this order:**
  1. One-sentence summary.
  2. Paragraphs on behavior: what it does, how it differs from similar hooks,
     identity/stability guarantees, unmount and SSR behavior, and edge cases.
  3. `@typeParam`, `@param` (use `{@link Type | label}` to link option
     types), `@returns`.
  4. One `@example` per distinct usage (two or more when the hook has several
     modes), tagged ` ```tsx ` when they contain JSX and ` ```ts ` otherwise.
  5. `@see` for relevant MDN pages where useful.
  6. Last line (new hooks always have it):
     `For a live, editable example, see the [useX docs page](https://altalyst-solutions.github.io/hookify/hooks/use-x).`
- **Helpers:** internal functions get `@param` / `@returns` as well, and
  mention why they exist if it isn't obvious.
- **Deprecations:** `@deprecated` with the replacement and removal plan; keep the
  old export working (see `use-debounce.ts`, `use-throttle.ts`).
- Prose is plain and specific; no marketing language.

## Tests (`tests/hooks/use-x.spec.ts`)

- Vitest + `@testing-library/react` (`renderHook`, `act`). Import the hook from
  `@/hooks`. Name the file after the hook and `describe("useX", ...)`.
- Fake timers are enabled globally by `tests/setup.ts`; advance them inside
  `act`. Don't re-enable or restore them per test.
- Test titles are plain behavior statements (`it("calls the callback once after
the delay", ...)`). Cover: the default behavior, every option, option
  changes between renders, cleanup on unmount, `StrictMode`, and SSR
  (`renderToString`) when the hook reads browser APIs. Add a case for every
  edge case the TSDoc promises.
- Coverage is enforced **per file**: lines, statements and functions >= 95%,
  branches >= 90% (`tests/coverage-thresholds.json`). Don't add code that can't
  be reached by a test (for example, empty placeholder functions).
- Arrow functions here too; use a `function` only when the test needs `this`.
- Tests must pass on React 18.0.0, 18 and the repo's React 19.

## Docs and demos (`docs-site/`)

Adding or changing a hook means all of the following, in the same PR:

1. `docs-site/docs/hooks/use-x.mdx`, copying a recent hook such as
   `use-rate-limited-callback.mdx`. Sections, in order: intro paragraph (how
   it differs from related hooks), `## When to use it`, `## Demo`
   (`<HookDemo files=... activeFile=... />`), `## Signature`, `## Usage notes`,
   `## Example(s)`, `## Hook source` (raw-loaded with
   `!!raw-loader!../../../packages/hookify/src/hooks/use-x.ts`).
   - Set `sidebar_position` to the next free number; deprecated hooks stay last,
     so shift them when adding.
   - Front matter metadata: `description` (one sentence, 20 to 160
     characters, ending with a period; quote it if it contains `: `),
     `keywords` (2 to 8 lowercase search terms not already in the name),
     `category` (`state`, `timing`, `async`, `dom`, `browser`, `lifecycle` or
     `refs`), optional `related` (other hook names) and `browserApis` (web
     features the hook relies on, such as `IntersectionObserver`; `[]` for
     none; not timers or `AbortController`). Deprecated hooks add
     `deprecated: true` and `replacedBy`. Use cases stay in
     `## When to use it`, which needs at least two bullets. `pnpm docs:check`
     enforces all of it.
2. Live demos in `docs-site/src/hook-examples/use-x/`: an `App.tsx` with
   `export default function App()` (the Sandpack entry; this is the one place
   `function` is required) that renders one or more small demo components,
   each in its own file as a named arrow-function `export const`. Demos
   import from `@altalyst/hookify`, are self-contained, and show the
   options that matter. They run the **published** package, so they only show a
   new hook after release or with `pnpm docs:dev:local`.
3. A changeset (below).
4. A size budget for the hook (see [Size budgets](#size-budgets) below).

The hooks index on the docs site is generated from `docs-site/docs/hooks`, and
the README links to it, so there is no hook list to update in `README.md`.

Admonitions with a title use brackets: `:::tip[Docs versions]`, never
`:::tip Docs versions`. The docs site enables Docusaurus' `future.v4` flag, so
the old form isn't parsed and shows up as raw text without any build error.
`pnpm docs:check` rejects it.

`docs-site/docs/api` is generated by typedoc and gitignored; never edit it.

Each hook page and the hooks index also show the hook's gzipped size, and the
index can be sorted by it. They come from `docs-site/src/data/hook-sizes.json`,
which `pnpm docs:build` generates from the same measurements as `pnpm size`
(`pnpm docs:sizes` runs just that step), and it is gitignored. Never put a size
in an `.mdx` page by hand, and nothing needs updating when a hook is added.

## Size budgets

`packages/hookify/size-budgets.json` holds a gzipped size budget for every
hook and for the whole package. `pnpm size` (run after `pnpm build`, and in CI)
fails when a hook is over its budget, has no budget, or has a budget but no
longer exists. You maintain the file in the same PR as the change, with
`pnpm size:update`; CI never writes it, and `pnpm size:update` never changes an
existing budget unless you name it.

Each PR's `size-report` job (a report only, not a gate) summarizes how the PR
changes the size of the bundle and of every hook compared with the base
branch.

- **New hook:** `pnpm build && pnpm size:update`, then commit the file.
- **Change that stays within the budget** (most edits): nothing to do.
- **Hook grows past its budget on purpose:** `pnpm build && pnpm size:update useX`
  and commit it, and say why in the PR. If the growth isn't intended, shrink
  the code instead. Never hand-edit a number just to make CI pass.
- **Shared code changes** (for example `useLatest`): several hooks can grow at
  once. `pnpm size` lists them all; reset the ones that should grow, such as
  `pnpm size:update useA useB`.
- **Hook gets smaller:** optional; `pnpm size:update useX` tightens its budget.
- **Hook removed or renamed:** `pnpm size:update` drops the old line and adds
  the new one.
- `pnpm size:update bundle` resets the whole-package budget, and
  `pnpm size:update --all` resets everything.

## Changesets and commits

- Any user-visible change to the published package needs a changeset:
  `.changeset/<kebab-name>.md` with front matter `"@altalyst/hookify": minor`
  (`minor` new hook or feature, `patch` fix, `major` breaking). Write the body
  from the consumer's view; it becomes the changelog. Never edit
  `CHANGELOG.md` or the `package.json` version by hand.
- Every changeset that bumps `@altalyst/hookify` also bumps
  `@altalyst/hookify-mcp`, usually as a `patch`: the MCP server bundles data
  built from the library, so releasing the library alone would leave it
  describing the old API. `pnpm changeset:check` (run in CI) enforces this.
  Changes to the MCP server itself (`packages/hookify-mcp/src`, `scripts`, its
  `package.json`) get their own `"@altalyst/hookify-mcp"` changeset.
- `packages/hookify-mcp/server.json` is the server's MCP Registry entry. Its
  versions follow `package.json` automatically (the root `version` script runs
  `.github/scripts/sync-server-json.mjs`), so never edit them by hand; its
  `name` must equal `package.json`'s `mcpName`, and `description` stays under
  100 characters. A test checks all three.
- Commit messages are conventional: `feat:`, `fix:`, `docs:`, `chore:`,
  `refactor:`, `test:`, `ci:`. Branches: `<type>/<kebab-description>`.
- Don't commit, push, branch or edit a PR unless asked. To prepare a PR, use
  the `prepare-pr` skill, and fill in `.github/PULL_REQUEST_TEMPLATE.md`
  truthfully (only tick a checklist item you actually ran).
