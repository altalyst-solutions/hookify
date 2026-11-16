/**
 * @file Checks that every release of the library also releases the MCP server.
 *
 * `@altalyst/hookify-mcp` bundles hook data generated from the library's
 * types and docs pages at build time. If the library were released alone, the
 * MCP server on npm would keep describing the previous version, so agents
 * would be told about a stale API. This script fails when the pending
 * changesets bump `@altalyst/hookify` without also bumping
 * `@altalyst/hookify-mcp`:
 *
 * ```sh
 * node .github/scripts/check-changesets.mjs
 * ```
 *
 * The fix is to list both packages in a changeset, usually with a `patch` for
 * the MCP server:
 *
 * ```md
 * ---
 * "@altalyst/hookify": minor
 * "@altalyst/hookify-mcp": patch
 * ---
 * ```
 */

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "yaml";

/** Absolute path of the repository root (two levels above this script). */
const ROOT = resolve(import.meta.dirname, "../..");

/** Where Changesets keeps pending changesets. */
const CHANGESET_DIR = resolve(ROOT, ".changeset");

/** The library. */
const LIBRARY = "@altalyst/hookify";

/** The MCP server, whose data is built from the library. */
const MCP_SERVER = "@altalyst/hookify-mcp";

/**
 * Reads the packages a changeset bumps.
 *
 * @param file - The changeset's file name, inside {@link CHANGESET_DIR}.
 * @returns The package names in its front matter.
 */
const bumpedPackages = (file) => {
  const source = readFileSync(resolve(CHANGESET_DIR, file), "utf8");
  const match = /^---\n([\s\S]*?)\n---/.exec(source);
  return match ? Object.keys(parse(match[1]) ?? {}) : [];
};

/** Runs the check and reports the result. */
const main = () => {
  const files = readdirSync(CHANGESET_DIR).filter(
    (file) => file.endsWith(".md") && file !== "README.md"
  );
  const bumped = new Set(files.flatMap(bumpedPackages));

  if (bumped.has(LIBRARY) && !bumped.has(MCP_SERVER)) {
    console.error(
      `The pending changesets release ${LIBRARY} but not ${MCP_SERVER}, so the MCP server on npm would keep describing the previous version of the library.\n\nAdd "${MCP_SERVER}": patch to one of these changesets:\n${files
        .filter((file) => bumpedPackages(file).includes(LIBRARY))
        .map((file) => `  - .changeset/${file}`)
        .join("\n")}`
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    files.length === 0
      ? "No pending changesets."
      : `${files.length} pending changeset(s); ${LIBRARY} and ${MCP_SERVER} are released together.`
  );
};

main();
