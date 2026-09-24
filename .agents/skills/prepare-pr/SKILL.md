---
name: prepare-pr
description: >-
  Standardizes preparing a branch name, grouped commits, and a pull request
  description for uncommitted changes in this repository, including
  follow-up commits pushed to an already-open PR. Use whenever asked to name
  a branch, group/organize commits, write git add/commit/push commands, or
  draft or update a pull request for the current working tree changes.
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

## 2. Determine whether this is new work or a follow-up

Don't assume — a branch/PR from this same change may already exist. Check:

1. `git branch --show-current` — are we already on a non-`main` branch?
2. `git rev-parse --abbrev-ref --symbolic-full-name @{u}` — does the current
   branch have an upstream (i.e. has it been pushed before)? Errors if not.
3. `gh pr view --json number,url,title,state 2>/dev/null` — is there already
   an open PR for this branch?

State what you found before proceeding (e.g. "You're on `feat/x` with an open
PR #42 — treating these as follow-up commits on that PR.") so the user can
correct you if the detection is wrong. Then:

- **No branch / no upstream / no PR** → this is new work: go to step 3.
- **Branch and/or upstream exist, but no PR yet** → keep the existing branch
  (skip step 3), continue at step 4, and draft the initial PR at step 5. If
  the branch already has commits from an earlier session (check
  `git log <default-branch>..HEAD --oneline`), the PR title/body must
  summarize the **whole branch**, not just today's newest commits — and the
  push command is still `git push -u origin <branch>` if `@{u}` errors (no
  upstream yet), even though the branch itself isn't brand new.
- **PR already open** → this is a follow-up: keep the existing branch (skip
  step 3), continue at step 4 using `git push` (not `-u`), and only refresh
  the PR body at step 5 if the change materially affects it.

## 3. Propose a branch name

_(New work only — skip this step for follow-ups on an existing branch.)_

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

## 4. Group commits and write commit commands

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

Finish with the push command: `git push -u origin <branch>` for new work,
or plain `git push` for a follow-up on a branch that already has an
upstream. As with `git add`/`git commit`, only run it if the user explicitly
asks — otherwise just present it.

## 5. Draft or update the pull request

**New work / no PR yet:** always start with a **PR title** — never omit it.
Use the same `type: description` format as the commit messages (e.g.
`docs: add MIT license, governance docs, and changelog automation`),
summarizing the branch as a whole in one line, imperative mood, no trailing
period. Present the title as its own labeled line (e.g. `**PR title:**
docs: ...`) separate from the body — never as a `# <title>` heading or plain
first line inside the body's markdown, since that duplicates GitHub's
separate title field once pasted into the description box.

Then follow [`.github/PULL_REQUEST_TEMPLATE.md`](../../PULL_REQUEST_TEMPLATE.md)
exactly for the body — same section order and headings:

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

When asked for the PR "in markdown", present the title on its own line first
(e.g. `**PR title:** docs: ...`), then wrap only the body in a
` ```markdown ` fenced code block so the body can be copy-pasted as-is into
GitHub's description field, full width (no manual line wraps inside
paragraphs), without the title getting swept in as part of the body text.

**Follow-up on an already-open PR:** don't draft a new title/body. Only
refresh what the new commits actually change:

- Append to (don't replace) `## Summary` if the new commits add meaningfully
  to what the PR does.
- Re-check `## Type of change` boxes if a new category now applies.
- Re-verify `## Checklist` items (lint/format/test/build, docs, changelog)
  against the latest state, not just the original commits.
- Leave everything else as-is. Present the diff of what would change and,
  only if the user confirms, apply it with `gh pr edit <number> --body "..."`
  (never push the PR update without confirmation, same as commits).

If the PR body is already accurate for the new commits (e.g. a small typo
fix that doesn't change scope), say so and skip the edit entirely.

## 6. Don't forget

- `CHANGELOG.md` is generated automatically by CI
  (`scripts/update-changelog.js`) right after the version bump — don't add a
  manual changelog commit unless drafting optional `## [Unreleased]` bullets
  by hand.
- Never stage (`git add`), commit, push, or edit a PR on your own initiative;
  only do so if the user explicitly confirms after reviewing the plan.
- Version bumps only happen when a branch merges into `main` (see
  `.github/workflows/ci.yml`'s `on: push: branches: [main]` trigger), so
  follow-up commits pushed to a feature branch don't trigger a bump on their
  own — all commits on the branch are scanned together at merge time.
