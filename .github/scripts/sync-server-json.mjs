/**
 * @file Copies the MCP server's package version into its `server.json`.
 *
 * `packages/hookify-mcp/server.json` describes the server to the MCP Registry,
 * and its version must match the npm release it points at. Changesets only
 * bumps `package.json`, so the root `version` script runs this right after
 * `changeset version`, and the "Version Packages" pull request bumps both:
 *
 * ```sh
 * node .github/scripts/sync-server-json.mjs
 * ```
 *
 * It also fails if `server.json` no longer names the same server and package
 * as `package.json`, since the registry rejects a mismatch.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** The MCP server package directory. */
const PACKAGE_DIR = resolve(import.meta.dirname, "../../packages/hookify-mcp");

/** Its `package.json`. */
const PACKAGE_JSON = resolve(PACKAGE_DIR, "package.json");

/** Its MCP Registry description. */
const SERVER_JSON = resolve(PACKAGE_DIR, "server.json");

/** Syncs the version and reports what changed. */
const main = () => {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
  const server = JSON.parse(readFileSync(SERVER_JSON, "utf8"));
  const [npmPackage] = server.packages ?? [];

  if (server.name !== pkg.mcpName) {
    throw new Error(
      `server.json name "${server.name}" must equal package.json mcpName "${pkg.mcpName}".`
    );
  }
  if (npmPackage?.identifier !== pkg.name) {
    throw new Error(
      `server.json packages[0].identifier "${npmPackage?.identifier}" must equal package.json name "${pkg.name}".`
    );
  }

  if (server.version === pkg.version && npmPackage.version === pkg.version) {
    console.log(`server.json already at ${pkg.version}.`);
    return;
  }

  const previous = server.version;
  server.version = pkg.version;
  npmPackage.version = pkg.version;
  writeFileSync(SERVER_JSON, `${JSON.stringify(server, null, 2)}\n`);
  console.log(`server.json: ${previous} -> ${pkg.version}`);
};

main();
