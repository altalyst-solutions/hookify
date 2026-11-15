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
  tests/hooks/      # Vitest + Testing Library specs, mirroring src/hooks
  CHANGELOG.md      # written by Changesets
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
   ```

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

   Once your PR merges, you can also check the page online in the
   [unreleased docs](https://altalyst-solutions.github.io/hookify/next/),
   where demos already run the code from `main`. See
   [Where docs changes appear](#where-docs-changes-appear).

## Development workflow

```bash
pnpm test           # run the test suite (vitest, watch mode)
pnpm coverage       # run tests with coverage
pnpm lint           # eslint
pnpm typecheck      # tsc -b (src and tests)
pnpm format         # prettier --write
pnpm format:check   # prettier --check
pnpm build          # build the library (tsc + vite)
```

Please make sure `pnpm lint`, `pnpm format:check`, `pnpm test --run`, and
`pnpm build` all pass before opening a pull request. CI runs the same
checks on every PR via `.github/workflows/pr-check.yml`.

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
| Stable  | [altalyst-solutions.github.io/hookify](https://altalyst-solutions.github.io/hookify/) | The latest release, with demos from npm       | When a release is published                                           |
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
