## Summary

<!-- What does this PR change, and why? -->

## Related issue(s)

<!-- Closes #123 -->

## Affected area(s)

- [ ] React hooks library (`packages/hookify`)
- [ ] MCP server (`packages/hookify-mcp`)
- [ ] Documentation
- [ ] CI / tooling
- [ ] Other

## Type of change

- [ ] Bug fix
- [ ] New hook
- [ ] Enhancement to an existing hook
- [ ] New or updated MCP server / tool
- [ ] Documentation
- [ ] Other (chore, refactor, tooling, etc.)

## Checklist

<!-- Check only completed items. Leave unrun or inapplicable items unchecked and explain why. -->

- [ ] `pnpm lint` passes
- [ ] `pnpm format:check` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm coverage` passes
- [ ] `pnpm build` passes
- [ ] `pnpm size` passes (after a build), with `size-budgets.json` updated via `pnpm size:update` if a hook was added, removed or grew on purpose
- [ ] `pnpm -F @altalyst/hookify-mcp typecheck` and `pnpm test:mcp --run` pass
- [ ] `pnpm docs:check`, `pnpm -F docs-site typecheck`, and `pnpm docs:build` pass (for docs changes)
- [ ] Verified React 18.0.0 and 18 compatibility (for React behavior changes; locally or in CI)
- [ ] Verified MCP tests on Node.js 22 (for MCP changes; locally or in CI)
- [ ] Added/updated tests for changed behavior (including MCP golden queries for new hooks)
- [ ] Added/updated documentation and demos as applicable
- [ ] Added required changeset(s) for user-facing package changes (library changesets also include the MCP server) — see
      [CONTRIBUTING.md](../CONTRIBUTING.md#commit-messages-and-versioning)
- [ ] `pnpm changeset:check` passes
