# Contributing to Hookify

Thanks for taking the time to contribute! This guide covers everything you
need to get set up, make a change, and submit a pull request.

## Getting started

Hookify requires **Node.js >= 24** (see `.nvmrc`) and npm.

```bash
git clone https://github.com/altalyst-solutions/hookify.git
cd hookify
npm run setup
```

## Project layout

```
src/hooks/        # Hook source files (one file per hook)
tests/hooks/       # Vitest + Testing Library specs, mirroring src/hooks
docs-site/         # Docusaurus documentation site
  docs/hooks/      # One .mdx page per hook (demo + docs)
  src/hook-examples # Example components used by the live demos
```

## Adding a new hook

1. Create `src/hooks/use-your-hook.ts` and export it from
   `src/hooks/index.ts`.
2. Write thorough JSDoc on the exported function, including `@example`
   blocks — this is used to auto-generate the API reference.
3. Add a matching spec at `tests/hooks/use-your-hook.spec.ts`.
4. Add a docs page at `docs-site/docs/hooks/use-your-hook.mdx` (copy an
   existing hook's page as a starting point) and, if useful, example
   components under `docs-site/src/hook-examples/use-your-hook/`.
5. Preview the docs locally instead of waiting on a deploy:

   ```bash
   npm run docs:install   # first time only
   npm run docs:dev       # http://localhost:3000, hot reload
   ```

## Development workflow

```bash
npm test              # run the test suite (vitest)
npm run coverage       # run tests with coverage
npm run lint           # eslint
npm run format         # prettier --write
npm run format:check   # prettier --check
npm run build          # build the library (tsc + vite)
```

Please make sure `npm run lint`, `npm run format:check`, `npm test`, and
`npm run build` all pass before opening a pull request. CI runs the same
checks on every PR via `.github/workflows/pr-check.yml`.

## Commit messages and versioning

Hookify uses [Changesets](https://github.com/changesets/changesets) to
manage versioning, `CHANGELOG.md`, and npm publishing
(`.github/workflows/ci.yml`, via
[changesets/action](https://github.com/changesets/action)).

If your change should be released (anything beyond docs/tooling that
doesn't affect the published package), add a changeset in the same PR:

```bash
npx changeset
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
`npx changeset add --empty` or simply skip adding a changeset — CI won't
block the PR, but please don't skip it for anything user-facing.

A local `pre-push` git hook (`.githooks/pre-push`, wired up automatically
by `npm run setup` via the `prepare` script) blocks pushes that change
`src/` or `package.json` without a changeset, as a safety net for forgetting
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
