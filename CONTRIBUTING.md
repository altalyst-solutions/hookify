# Contributing to Hookify

Thanks for taking the time to contribute! This guide covers everything you
need to get set up, make a change, and submit a pull request.

## Getting started

Hookify requires **Node.js >= 24** (see `.nvmrc`) and **pnpm**, pinned to an exact version in the `packageManager` field of `package.json`. Corepack (`corepack enable pnpm`) and recent pnpm versions switch to the pinned version automatically inside this repo, so you always match CI. If you have neither, run `npm install -g pnpm`. To upgrade pnpm, change the `packageManager` field; CI reads the same field.

```bash
git clone https://github.com/altalyst-solutions/hookify.git
cd hookify
pnpm install
```

## Project layout

The repository is a [pnpm workspace](https://pnpm.io/workspaces). A single
`pnpm install` at the root installs everything, and every command below runs
from the root.

```
packages/hookify/   # the published @altalyst/hookify package
  src/hooks/        # Hook source files (one file per hook)
  src/testing/      # Test helpers, published as @altalyst/hookify/testing
  tests/hooks/      # Vitest + Testing Library specs, mirroring src/hooks
  tests/testing/    # Specs for the test helpers
  CHANGELOG.md      # written by Changesets
packages/hookify-mcp/ # MCP server that gives AI agents the hooks' docs
  scripts/build-data.ts # builds its hook data from the library's types and the docs pages
  src/detect/       # finds hand-written code that a hook could replace (parses with @babel/parser)
docs-site/          # Docusaurus documentation site (private workspace package)
  docs/hooks/       # One .mdx page per hook (demo + docs)
  src/hook-examples # Example components used by the live demos
```

## Adding a new hook

1. Create `packages/hookify/src/hooks/use-your-hook.ts` and export it from
   `packages/hookify/src/hooks/index.ts`.
2. Write thorough doc comments (TSDoc style) on the exported function,
   including `@example` blocks — this is used to auto-generate the API
   reference. Don't put types in braces: use `@param name - description`,
   `@returns description` and `@typeParam T - description`. `pnpm lint`
   enforces this. Tag code examples ` ```tsx ` when they contain JSX and
   ` ```ts ` otherwise.
3. Add a matching spec at `packages/hookify/tests/hooks/use-your-hook.spec.ts`.
4. Add a docs page at `docs-site/docs/hooks/use-your-hook.mdx` (copy an
   existing hook's page as a starting point) and, if useful, example
   components under `docs-site/src/hook-examples/use-your-hook/`. Its front
   matter needs this metadata, which the docs site shows on the hooks index
   and AI agents use to recommend hooks:

   ```yaml
   title: useYourHook
   description: One sentence on what it does and a typical use, 20 to 160 characters.
   keywords: [search terms, people would use, lowercase]
   category: timing # state, timing, async, dom, browser, lifecycle or refs
   related: [useOtherHook] # optional
   browserApis: [IntersectionObserver] # web features it relies on, [] for none
   testing: [installIntersectionObserver] # optional: fakes from @altalyst/hookify/testing
   ```

   If a fake in `@altalyst/hookify/testing` covers the browser API, list it in
   `testing` (`pnpm docs:check` checks that it exists), add a bullet to the
   page's "Usage notes" that links to the [testing guide](docs-site/docs/testing.md),
   and, for a new fake, add a section to that guide.

   Use cases go in the page's `## When to use it` section (at least two
   bullets), not in the front matter. Quote a description that contains
   `: `. A deprecated hook also sets `deprecated: true` and
   `replacedBy: useNewHook`. `pnpm docs:check` validates all of this, and CI
   runs it on every pull request.

   Give admonitions a title with brackets, as in `:::tip[Docs versions]`. The
   older `:::tip Docs versions` form shows up as raw text on this site, and
   `pnpm docs:check` rejects it.

5. Preview the docs locally instead of waiting on a deploy:

   ```bash
   pnpm docs:dev       # http://localhost:3000, hot reload
   ```

   Live demos run the **published** `@altalyst/hookify` from npm, so a new or
   changed hook won't appear in them until it is released. To preview
   unreleased changes, run the demos against your local build instead:

   ```bash
   pnpm docs:dev:local   # builds the library, then starts the docs site
   pnpm watch            # optional, in another terminal: rebuild on changes
   ```

   Demos use the built `packages/hookify/dist/` (not `src/`), so edits to a hook only reach
   them while `pnpm watch` is running; docs pages and example components
   hot reload on their own. If a demo looks stale, refresh the page. Plain
   `pnpm docs:dev` is unaffected and keeps using the npm release.

   docs-site depends on the library as a workspace package
   (`"@altalyst/hookify": "workspace:*"`), so editor types for example
   components come from the local `packages/hookify/dist/` build. Run
   `pnpm build` once if your editor reports that `@altalyst/hookify` can't be
   resolved.

   Hook pages and the hooks index show each hook's gzipped size, and the
   index can be sorted by it. These numbers are generated by `pnpm docs:build`
   and `pnpm docs:dev:local` from the same measurements as `pnpm size` (see
   [Size budgets](#size-budgets)), so there is nothing to write by hand. Plain
   `pnpm docs:dev` shows them only if they were generated earlier.

   Once your PR merges, you can also check the page online in the
   [unreleased docs](https://altalyst-solutions.github.io/hookify/next/),
   where demos already run the code from `main`. See
   [Where docs changes appear](#where-docs-changes-appear).

6. Run `pnpm build && pnpm size:update` and commit the new line in
   `packages/hookify/size-budgets.json`. See [Size budgets](#size-budgets).

## Development workflow

```bash
pnpm test           # run the test suite (vitest, watch mode)
pnpm coverage       # run tests with coverage
pnpm lint           # eslint
pnpm typecheck      # tsc -b (src and tests)
pnpm typecheck:all  # builds, then type-checks the library, MCP server, docs site and e2e/consumers fixtures
pnpm format         # prettier --write
pnpm format:check   # prettier --check
pnpm build          # build the library (tsc + vite), then the MCP server
pnpm check:package  # after a build: publint and are-the-types-wrong on the packed packages
pnpm size           # after a build: gzipped size of the bundle, the testing entry and each hook against packages/hookify/size-budgets.json
pnpm size:update    # after a build: add budgets for new hooks, drop deleted ones; name a hook to raise its budget
pnpm test:consumers # after a build: install the packed library into the e2e/consumers fixtures
pnpm setup:consumers # once, after a build: install the fixtures' dependencies in place, linked to the library, so editors resolve their imports
pnpm test:mcp       # MCP server tests, including find_hook's golden queries
```

Please make sure `pnpm lint`, `pnpm format:check`, `pnpm test --run`,
`pnpm build`, and `pnpm size` (after the build) all pass before opening a pull
request. CI runs the same
checks on every PR via `.github/workflows/pr-check.yml`.

### Size budgets

Every hook, the package as a whole and the `@altalyst/hookify/testing` entry
have a gzipped size budget in
`packages/hookify/size-budgets.json`. `pnpm size` (run in CI on every pull
request, after a build) measures what a consumer would bundle when importing
only that hook, and fails when a hook goes over its budget, has no budget, or
has a budget but no longer exists. Contributors maintain the file in the pull
request that changes a hook's size, and reviewers see every change to it in
the diff. CI never writes it, and `pnpm size:update` never changes an existing
budget unless you name it, so a regression can't be hidden by accident.

Every pull request also gets a size report in the `size-report` job's summary
(open the job in the PR's checks and look at the summary). It compares the
bundle and every hook with the base branch and lists those that changed. It
only reports, so use it to check that a change grew or shrank the hooks you
expected.

| You are...                                    | Do this                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adding a hook                                 | Run `pnpm build && pnpm size:update`, then commit the new line in `size-budgets.json`.                                                                        |
| Changing a hook and staying within its budget | Nothing. New budgets leave about 10% of headroom for small changes.                                                                                           |
| Growing a hook past its budget on purpose     | Run `pnpm build && pnpm size:update useYourHook` and commit the new number. Explain the growth in the pull request. If it wasn't on purpose, shrink the code. |
| Changing shared code, such as `useLatest`     | Several hooks can grow at once. `pnpm size` lists every one over budget. Reset the ones that should grow, for example `pnpm size:update useA useB`.           |
| Making a hook smaller                         | Optional. To keep the budget tight, run `pnpm size:update useYourHook`.                                                                                       |
| Removing or renaming a hook                   | Run `pnpm size:update` to drop the old line and add the new one.                                                                                              |

The testing entry has one budget for all its helpers. When you add or grow a
helper in `src/testing`, `pnpm size` may fail on it. Run
`pnpm build && pnpm size:update testing` and commit the new number.

`pnpm size:update bundle` resets the whole-package budget,
`pnpm size:update testing` resets the testing entry's, and
`pnpm size:update --all` resets every budget.

## Commit messages and versioning

Hookify uses [Changesets](https://github.com/changesets/changesets) to
manage versioning, `packages/hookify/CHANGELOG.md`, and npm publishing
(`.github/workflows/ci.yml`, via
[changesets/action](https://github.com/changesets/action)).

If your change should be released (anything beyond docs/tooling that
doesn't affect the published package), add a changeset in the same PR:

```bash
pnpm changeset
```

This prompts you for the bump type (major/minor/patch) and a short summary,
then writes a Markdown file under `.changeset/` — commit it with your
change. You can include multiple bullet points in the summary if useful;
it becomes the changelog entry for this release, so write it for consumers
of the package, not just for reviewers.

The repository publishes two packages: the library, `@altalyst/hookify`, and
the MCP server, `@altalyst/hookify-mcp`, which bundles data built from the
library's types and docs. Whenever a changeset bumps the library, also select
the MCP server (usually as a `patch`), so its data is released with the
library:

```md
---
"@altalyst/hookify": minor
"@altalyst/hookify-mcp": patch
---
```

`pnpm changeset:check` fails when the library is released without the MCP
server, and CI runs it on every pull request.

Releasing the MCP server also updates its listing on the
[MCP Registry](https://registry.modelcontextprotocol.io): the "Version
Packages" pull request bumps `packages/hookify-mcp/server.json` along with its
`package.json`, and after the npm publish CI runs
`.github/workflows/mcp-registry.yml`, which publishes `server.json` using
GitHub's OIDC identity. Never edit the versions in `server.json` by hand. To
retry a failed listing, run that workflow manually from the Actions tab.

When your PR merges to `main`, the `changesets/action` bot opens or updates
a "Version Packages" pull request that bumps `package.json` and updates
`CHANGELOG.md` from the accumulated changesets. Merging that PR triggers
the actual npm publish — you don't need to (and shouldn't) edit
`CHANGELOG.md` or `package.json`'s version by hand.

If a change genuinely doesn't need a release (e.g. a docs typo fix), run
`pnpm changeset add --empty` or simply skip adding a changeset — CI won't
block the PR, but please don't skip it for anything user-facing. Note that
docs changes only reach the stable docs with a release; see below.

### Where docs changes appear

The docs site has two versions, deployed by
`.github/workflows/docs-deploy.yml`:

| Version | URL                                                                                   | Shows                                         | Updated                                                               |
| ------- | ------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| Stable  | [altalyst-solutions.github.io/hookify](https://altalyst-solutions.github.io/hookify/) | The latest release, with demos from npm       | When a library release is published                                   |
| Next    | […/hookify/next](https://altalyst-solutions.github.io/hookify/next/)                  | `main`, with demos running the code on `main` | On every push to `main` that touches the docs or the library's `src/` |

So a docs change, including a typo fix, shows up on next as soon as it merges,
but on stable only with the next release. Stable is always built from the
release tag, so re-running the docs workflow won't pick it up either. If a
docs fix should reach stable sooner, add a `patch` changeset so it ships with
a release.

A local `pre-push` git hook (`.githooks/pre-push`, wired up automatically
by `pnpm install` via the `prepare` script) blocks pushes that change
`packages/hookify/src/` or `packages/hookify/package.json` without a changeset, as a safety net for forgetting
the step above. Bypass it for an intentional exception with
`git push --no-verify`.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make your change, following the steps above.
3. Open a pull request describing what changed and why. Link any related
   issues.

If you're using an AI coding agent, it can follow the `prepare-pr` skill to
propose a branch name, group your changes into commits, and draft the PR
description in this repo's standard format. It's mirrored at
[`.github/skills/prepare-pr/`](.github/skills/prepare-pr/SKILL.md),
`.claude/skills/prepare-pr/`, and `.agents/skills/prepare-pr/` so it's
auto-discovered by GitHub Copilot, Claude Code, and other tools that follow
the [Agent Skills spec](https://agentskills.io).

## Reporting bugs and requesting features

Use the [issue templates](.github/ISSUE_TEMPLATE) to report bugs or request
features, or start a discussion in
[GitHub Discussions](https://github.com/altalyst-solutions/hookify/discussions)
for open-ended questions or ideas.

## Code of conduct

This project follows the [Code of Conduct](./CODE_OF_CONDUCT.md). By
participating, you agree to uphold it.
