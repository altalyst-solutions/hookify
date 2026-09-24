---
name: prepare-pr
description: >-
  Standardizes preparing a branch name, grouped commits, and a pull request
  description for uncommitted changes in this repository. Use whenever asked
  to name a branch, group/organize commits, write git add/commit commands, or
  draft a pull request for the current working tree changes.
---

# Preparing a branch, commits, and a pull request

> This file is mirrored at `.github/skills/prepare-pr/`, `.claude/skills/prepare-pr/`,
> and `.agents/skills/prepare-pr/` so it's auto-discovered regardless of which
> AI coding tool a contributor uses (GitHub Copilot, Claude Code, etc. — see
> the [Agent Skills spec](https://agentskills.io)). Keep all three copies in
> sync.

This skill codifies how changes in this repository are turned into a branch,
a set of logical commits, and a pull request. It never stages or commits
anything itself — it only proposes commands and text for the user (or the
calling agent) to review and run.

## 1. Inspect the changes

Run `git status --porcelain` and `git diff` (or `git diff --stat`) to see
what's changed. Group the changed files into logical, self-contained units of
work (e.g. "license", "README rewrite", "CI change", "new hook + its tests +
its docs page"). Each group becomes one commit. Don't mix unrelated concerns
in a single commit.

## 2. Propose a branch name

Use kebab-case, prefixed with the change's conventional-commit type, and keep
it short but descriptive of the overall change:

```
<type>/<short-description>
```

Where `<type>` is one of `feat`, `fix`, `docs`, `chore`, `refactor`, `test`,
matching whichever type best summarizes the _branch as a whole_ (if the
branch mixes types, pick the most significant one — e.g. a new hook plus its
docs is still `feat/...`).

Examples: `feat/use-intersection-observer-hook`,
`fix/use-mounted-strict-mode-guard`,
`docs/license-governance-and-changelog-automation`.

## 3. Group commits and write commit commands

Present the commits as a table with three columns: commit description, the
exact `git add` command(s) for that commit's files, and the exact
`git commit` command with its message. Do not run these commands yourself
unless the user explicitly asks you to stage/commit — treat them as
information to review first.

Every commit message must follow this repo's versioning convention (see
[`CONTRIBUTING.md`](../../../CONTRIBUTING.md#commit-messages-and-versioning)),
because **every commit included in a push to `main` is scanned** to decide
the automatic version bump (see `.github/workflows/ci.yml`):

| Commit message contains...                              | Version bump |
| ------------------------------------------------------- | ------------ |
| `BREAKING CHANGE`, or a `type!:` prefix (e.g. `feat!:`) | major        |
| `feat` (anywhere in the message)                        | minor        |
| anything else                                           | patch        |

Use `feat:` only when the change is genuinely user-facing new functionality
(e.g. a new hook). Use `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, or
`ci:` for everything else, and double-check none of those messages
accidentally contain the substring `feat` or the words `BREAKING CHANGE`
unless that bump is intended.

If the CLI's git commit trailer convention is active for this session,
append it as a second `-m` flag on every `git commit` command, e.g.:

```
git commit -m "docs: add MIT license" -m "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

## 4. Draft the pull request

Follow [`.github/PULL_REQUEST_TEMPLATE.md`](../../PULL_REQUEST_TEMPLATE.md)
exactly — same section order and headings:

- `## Summary` — one clear paragraph (not a bulleted list, not manually
  line-wrapped) describing what changed and why, unless the user asks for a
  different format.
- `## Related issue(s)` — link any issues this closes/references, or state
  "None" if there aren't any.
- `## Type of change` — check the boxes that apply from the template
  (Bug fix / New hook / Enhancement to an existing hook / Documentation /
  Other).
- `## Checklist` — check off the items that were actually verified locally
  (lint, format:check, test, build, tests/docs added, `CHANGELOG.md`
  "Unreleased" entry, commit message convention). Only check an item if it
  was genuinely run/confirmed.

When asked for the PR "in markdown", wrap the whole title + body in a single
` ```markdown ` fenced code block so it can be copy-pasted as-is, full width
(no manual line wraps inside paragraphs).

## 5. Don't forget

- `CHANGELOG.md` is generated automatically by CI
  (`scripts/update-changelog.js`) right after the version bump — don't add a
  manual changelog commit unless drafting optional `## [Unreleased]` bullets
  by hand.
- Never stage (`git add`) or commit on your own initiative; only do so if the
  user explicitly confirms after reviewing the plan.
