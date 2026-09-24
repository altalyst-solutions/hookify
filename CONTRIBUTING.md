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

Hookify uses fully automated releases: every push to `main` bumps the
version and publishes to npm (`.github/workflows/ci.yml`, via
[gh-action-bump-version](https://github.com/phips28/gh-action-bump-version)).
The version bump is derived by scanning **every commit message included in
the push** (not just the last one — this matters since PRs here merge via a
regular merge commit, not a squash), so please follow this convention in
your commit messages:

| Commit message contains...                              | Version bump |
| ------------------------------------------------------- | ------------ |
| `BREAKING CHANGE`, or a `type!:` prefix (e.g. `feat!:`) | major        |
| `feat` (anywhere in the message)                        | minor        |
| anything else                                           | patch        |

Examples: `feat: add useIntersectionObserver hook`,
`fix: guard useMounted against StrictMode double-invoke`,
`feat!: rename \`delay\` option to \`wait\` (BREAKING CHANGE)`.

`CHANGELOG.md` is updated automatically right after each release by parsing
these same commit messages — you don't need to edit it by hand, but feel
free to add entries under `## [Unreleased]` in your PR if you'd like to
draft the wording yourself.

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
