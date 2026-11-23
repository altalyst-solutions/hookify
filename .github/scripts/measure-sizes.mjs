/**
 * @file Measures the gzipped size of the bundle and of every hook.
 *
 * Shared by `update-size-budgets.mjs` and `generate-hook-sizes.mjs`, so every
 * tool reports exactly what `pnpm size` checks. It runs `size-limit` with the
 * repository's config in a mode that doesn't require budgets to exist (see
 * `.size-limit.mjs`). Run `pnpm build` first.
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

/** Absolute path of the repository root (two levels above this script). */
const ROOT = resolve(import.meta.dirname, "../..");

/** The name `.size-limit.mjs` gives to the whole-package check. */
export const BUNDLE_CHECK = "bundle (all hooks)";

/**
 * Measures the bundle and every hook.
 *
 * @returns The whole-package size in bytes, and a map from hook name to its
 *   size in bytes, both gzipped.
 */
export const measureSizes = () => {
  const result = spawnSync("pnpm", ["exec", "size-limit", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, SIZE_LIMIT_MEASURE: "1" },
  });

  let rows;
  try {
    rows = JSON.parse(result.stdout);
  } catch {
    process.stderr.write(result.stderr || result.stdout);
    throw new Error(
      "size-limit didn't report any sizes. Run `pnpm build` first."
    );
  }

  return {
    bundle: rows.find((row) => row.name === BUNDLE_CHECK)?.size,
    hooks: Object.fromEntries(
      rows
        .filter((row) => row.name !== BUNDLE_CHECK)
        .map((row) => [row.name, row.size])
    ),
  };
};
