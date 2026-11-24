/**
 * @file Runs the consumer smoke tests against the packed library.
 *
 * Each folder in `e2e/consumers` is a tiny project that uses
 * `@altalyst/hookify` the way a consumer would: from Node ESM, from Node
 * CommonJS, from TypeScript with `node16` and `bundler` module resolution, and
 * from a production Vite build. This script packs the library like `pnpm
 * publish` does, copies each fixture into a temporary directory outside the
 * workspace, installs it with npm along with the tarball, and runs its `test`
 * script. A fixture fails when the package's `exports`, types or bundles don't
 * work for that kind of consumer.
 *
 * To add a fixture, add a folder with a `package.json` that has a `test`
 * script. The CI job picks it up automatically.
 *
 * Run it after `pnpm build`, optionally naming the fixtures to run:
 *
 * ```sh
 * node e2e/consumers/run.mjs [fixture...]
 * ```
 *
 * By default each fixture's `test` script runs. Use `--script=<name>` to run
 * another npm script instead, such as `typecheck` for a quick type-only check.
 * Without fixture names, only fixtures that define the script run.
 *
 * ```sh
 * node e2e/consumers/run.mjs --script=typecheck
 * ```
 *
 * The fixtures only get their dependencies inside the temporary directories,
 * so an editor shows unresolved imports in the folder itself. To fix that, run
 * the script with `--install` to install each fixture's dependencies in place,
 * with `@altalyst/hookify` linked to `packages/hookify` (`node_modules` is
 * ignored by Git, and `package.json` stays untouched). The link follows every
 * `pnpm build`, so run `--install` once, not after each change to the library:
 *
 * ```sh
 * node e2e/consumers/run.mjs --install [fixture...]
 * ```
 */

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/** Absolute path of the folder that holds the fixtures. */
const FIXTURES_DIR = import.meta.dirname;

/** Absolute path of the repository root. */
const ROOT = resolve(FIXTURES_DIR, "../..");

/** Absolute path of the library package. */
const LIBRARY_DIR = resolve(ROOT, "packages/hookify");

/**
 * Lists the fixtures to run.
 *
 * @param requested - The fixture names from the command line.
 * @param script - The npm script that will run in each fixture.
 * @returns The requested names, or every fixture that defines the script.
 */
const listFixtures = (requested, script) => {
  const all = readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(join(FIXTURES_DIR, entry.name, "package.json"))
    )
    .map((entry) => entry.name);

  const unknown = requested.filter((name) => !all.includes(name));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown fixture(s): ${unknown.join(", ")}. Available: ${all.join(", ")}`
    );
  }

  return requested.length > 0
    ? requested
    : all.filter(
        (name) =>
          JSON.parse(
            readFileSync(join(FIXTURES_DIR, name, "package.json"), "utf8")
          ).scripts?.[script]
      );
};

/**
 * Packs the library into a directory.
 *
 * @param destination - The directory to write the tarball to.
 * @returns The absolute path of the tarball.
 */
const packLibrary = (destination) => {
  if (!existsSync(join(LIBRARY_DIR, "dist"))) {
    throw new Error("The library isn't built. Run `pnpm build` first.");
  }

  const { name, version } = JSON.parse(
    readFileSync(join(LIBRARY_DIR, "package.json"), "utf8")
  );
  execFileSync(
    "pnpm",
    ["-F", name, "pack", "--pack-destination", destination],
    { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] }
  );
  return join(
    destination,
    `${name.replace("@", "").replace("/", "-")}-${version}.tgz`
  );
};

/** Options for `npm install` in a fixture. */
const INSTALL_ARGS = ["install", "--no-audit", "--no-fund", "--loglevel=error"];

/**
 * Installs a fixture with the tarball and runs its `test` script.
 *
 * @param name - The fixture's folder name.
 * @param workDir - A temporary directory to copy the fixture into.
 * @param tarball - The packed library.
 */
const runFixture = (name, workDir, tarball, script) => {
  const dir = join(workDir, name);
  cpSync(join(FIXTURES_DIR, name), dir, {
    recursive: true,
    filter: (source) => !source.includes("node_modules"),
  });

  const options = { cwd: dir, stdio: "inherit" };
  execFileSync("npm", [...INSTALL_ARGS, tarball], options);
  execFileSync("npm", ["run", script, "--silent"], options);
};

/**
 * Installs a fixture's dependencies inside the fixture's own folder, with the
 * library linked to the workspace package instead of copied, so editors can
 * resolve its imports. A link follows every rebuild of `dist`, so nothing goes
 * stale when the library gains exports. Neither `package.json` nor a lockfile
 * is written.
 *
 * @param name - The fixture's folder name.
 */
const installFixture = (name) => {
  execFileSync(
    "npm",
    [...INSTALL_ARGS, "--no-save", "--no-package-lock", LIBRARY_DIR],
    { cwd: join(FIXTURES_DIR, name), stdio: "inherit" }
  );
};

/** Runs the fixtures and reports the result. */
const main = () => {
  const args = process.argv.slice(2);
  const install = args.includes("--install");
  const script =
    args
      .find((arg) => arg.startsWith("--script="))
      ?.slice("--script=".length) ?? "test";
  const fixtures = listFixtures(
    args.filter((arg) => !arg.startsWith("--")),
    script
  );
  const workDir = mkdtempSync(join(tmpdir(), "hookify-consumers-"));
  const failures = [];

  try {
    if (install && !existsSync(join(LIBRARY_DIR, "dist"))) {
      throw new Error("The library isn't built. Run `pnpm build` first.");
    }
    const tarball = install ? undefined : packLibrary(workDir);

    for (const name of fixtures) {
      console.log(`\n=== ${name}`);
      try {
        if (install) {
          installFixture(name);
          console.log(`Installed ${name}`);
        } else {
          runFixture(name, workDir, tarball, script);
          console.log(`✔ ${name}`);
        }
      } catch {
        failures.push(name);
        console.error(`✘ ${name}`);
      }
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    console.error(
      `\nConsumer fixtures failed:\n  - ${failures.join("\n  - ")}`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\nAll ${fixtures.length} consumer fixture(s) passed.`);
};

main();
