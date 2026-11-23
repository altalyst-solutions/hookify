/**
 * @file Checks the packed npm tarballs of the published packages.
 *
 * Packaging mistakes only show up for consumers: a wrong `exports` map, types
 * that TypeScript reads as ESM when the code is CommonJS (or the reverse), or
 * a missing declaration file. This script packs each published package the
 * same way `pnpm publish` does, then lints the tarball with `publint` and,
 * for packages that ship types, checks how TypeScript resolves them with
 * `@arethetypeswrong/cli`. Run it after `pnpm build`:
 *
 * ```sh
 * node .github/scripts/check-package.mjs
 * ```
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/** Absolute path of the repository root (two levels above this script). */
const ROOT = resolve(import.meta.dirname, "../..");

/** Directories, relative to the root, of the packages that are published. */
const PACKAGE_DIRS = ["packages/hookify", "packages/hookify-mcp"];

/**
 * Runs a command that is installed in the workspace.
 *
 * @param command - The executable, such as `pnpm`.
 * @param args - Its arguments.
 * @returns Everything the command printed to stdout.
 */
const run = (command, args) =>
  execFileSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

/**
 * Packs a package into a directory.
 *
 * @param dir - The package directory, relative to {@link ROOT}.
 * @param destination - The directory to write the tarball to.
 * @returns The absolute path of the tarball.
 */
const pack = (dir, destination) => {
  const { name, version } = JSON.parse(
    readFileSync(resolve(ROOT, dir, "package.json"), "utf8")
  );
  run("pnpm", ["-F", name, "pack", "--pack-destination", destination]);
  return join(
    destination,
    `${name.replace("@", "").replace("/", "-")}-${version}.tgz`
  );
};

/** Runs the checks and reports the result. */
const main = () => {
  const destination = mkdtempSync(join(tmpdir(), "hookify-pack-"));
  const failures = [];

  try {
    for (const dir of PACKAGE_DIRS) {
      const { name, types } = JSON.parse(
        readFileSync(resolve(ROOT, dir, "package.json"), "utf8")
      );
      const tarball = pack(dir, destination);

      /** Each check that failed for this package. */
      const checks = [
        ["publint", ["exec", "publint", "run", tarball, "--strict"]],
        // Every resolution mode is checked, including `node10`, which can't
        // read `exports`: `typesVersions` makes `@altalyst/hookify/testing`
        // resolve for it.
        ...(types ? [["attw", ["exec", "attw", tarball]]] : []),
      ];

      for (const [tool, args] of checks) {
        try {
          console.log(`\n${name}: ${tool}`);
          console.log(run("pnpm", args));
        } catch {
          failures.push(`${name}: ${tool}`);
        }
      }
    }
  } finally {
    rmSync(destination, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    console.error(`\nPackage checks failed:\n  - ${failures.join("\n  - ")}`);
    process.exitCode = 1;
    return;
  }

  console.log("\nAll package checks passed.");
};

main();
