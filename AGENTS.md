# Hookify agent guide

Hookify (`@altalyst/hookify`) is a library of React hooks. It supports **React
18.0.0 and later, including 19**, runs on Node >= 24, and has **no runtime
dependencies**. Follow this guide when changing code here; see
[CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor workflow.

## Layout

```
src/hooks/              one file per hook (use-kebab-case.ts), exported from src/hooks/index.ts
src/utils/              internal helpers (dev-warnings.ts), not part of the public API
tests/hooks/            one spec per hook, mirrors src/hooks
docs-site/docs/hooks/   one .mdx page per hook
docs-site/src/hook-examples/use-x/   live demo components (App.tsx plus one file per demo)
.changeset/             release notes, one file per user-visible change
```

## Commands

Run these before finishing. CI (`.github/workflows/pr-check.yml`) runs the same.

```bash
npm run format:check   # prettier
npm run lint           # eslint, including TSDoc rules
npm run typecheck      # tsc -b (src and tests)
npm run coverage       # vitest with per-file coverage thresholds
npm run build          # typecheck + vite build
```

`npm run format` fixes formatting. To run a single spec: `npx vitest run tests/hooks/use-x.spec.ts`.

When a change touches React behavior, also run the React 18 matrix CI uses, then
restore the repo's React version:

```bash
for V in 18.0.0 18; do
  npm install --no-save "react@$V" "react-dom@$V" "@types/react@${V%%.*}" "@types/react-dom@${V%%.*}"
  npx tsc -b && npm run test -- --run
done
```

If you touched docs, also run `npm run build && (cd docs-site && npm run typecheck) && npm run docs:build`.

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

## Documentation style (TSDoc)

Everything in `src/` is documented, and `npm run lint` enforces the syntax
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
   `## Example(s)`, `## Hook source` (raw-loaded from `src/`).
   - Set `sidebar_position` to the next free number; deprecated hooks stay last,
     so shift them when adding.
2. Live demos in `docs-site/src/hook-examples/use-x/`: an `App.tsx` with
   `export default function App()` (the Sandpack entry; this is the one place
   `function` is required) that renders one or more small demo components,
   each in its own file as a named arrow-function `export const`. Demos
   import from `@altalyst/hookify`, are self-contained, and show the
   options that matter. They run the **published** package, so they only show a
   new hook after release or with `npm run docs:dev:local`.
3. A row in the `README.md` hooks table (alphabetical by hook name).
4. A changeset (below).

`docs-site/docs/api` is generated by typedoc and gitignored; never edit it.

## Changesets and commits

- Any user-visible change to the published package needs a changeset:
  `.changeset/<kebab-name>.md` with front matter `"@altalyst/hookify": minor`
  (`minor` new hook or feature, `patch` fix, `major` breaking). Write the body
  from the consumer's view; it becomes the changelog. Never edit
  `CHANGELOG.md` or the `package.json` version by hand.
- Commit messages are conventional: `feat:`, `fix:`, `docs:`, `chore:`,
  `refactor:`, `test:`, `ci:`. Branches: `<type>/<kebab-description>`.
- Don't commit, push, branch or edit a PR unless asked. To prepare a PR, use
  the `prepare-pr` skill, and fill in `.github/PULL_REQUEST_TEMPLATE.md`
  truthfully (only tick a checklist item you actually ran).
