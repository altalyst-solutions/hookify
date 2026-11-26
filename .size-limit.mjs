/**
 * @file Size budgets for the built `@altalyst/hookify` bundle.
 *
 * `size-limit` bundles what a consumer would import and compares its gzipped
 * size with a budget. The checks are generated from the library's build
 * output, so every hook is covered:
 *
 * - `bundle`: the whole package, importing everything.
 * - one check per hook, importing only that hook, which also proves that the
 *   hook is tree-shakeable.
 * - `testing`: the `@altalyst/hookify/testing` entry, importing everything. It
 *   is for tests, so it has one budget rather than one per helper.
 *
 * Budgets live in `packages/hookify/size-budgets.json`. This config fails when
 * a hook has no budget, or when a budget names a hook that no longer exists,
 * so the file can't drift from the library. Run it after `pnpm build`:
 *
 * ```sh
 * pnpm size
 * ```
 *
 * `pnpm size:update` maintains the budgets file. It runs this config with
 * `SIZE_LIMIT_MEASURE=1`, which skips those checks and gives hooks without a
 * budget a generous placeholder, so every hook is measured the same way.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Absolute path of the repository root. */
const ROOT = import.meta.dirname;

/** Path of the built ES bundle, relative to the root. */
const BUNDLE = "packages/hookify/dist/hookify.js";

/** Path of the built ES bundle of the testing entry, relative to the root. */
const TESTING_BUNDLE = "packages/hookify/dist/testing.js";

/** Path of the budgets file, relative to the root. */
const BUDGETS = "packages/hookify/size-budgets.json";

/** Whether `pnpm size:update` is only measuring, so budgets can be missing. */
const measureOnly = process.env.SIZE_LIMIT_MEASURE === "1";

/** The limit given to a hook without a budget while measuring. */
const PLACEHOLDER_LIMIT = "100 kB";

if (!existsSync(resolve(ROOT, BUNDLE))) {
  throw new Error(`${BUNDLE} doesn't exist. Run \`pnpm build\` first.`);
}

if (!existsSync(resolve(ROOT, TESTING_BUNDLE))) {
  throw new Error(`${TESTING_BUNDLE} doesn't exist. Run \`pnpm build\` first.`);
}

/**
 * The budgets: `bundle` for the whole package, `testing` for the testing
 * entry, `hooks` for each hook.
 */
const budgets =
  measureOnly && !existsSync(resolve(ROOT, BUDGETS))
    ? { hooks: {} }
    : JSON.parse(readFileSync(resolve(ROOT, BUDGETS), "utf8"));

/** Every exported hook, such as `useToggleState`. */
const hooks = Object.keys(await import(pathToFileURL(resolve(ROOT, BUNDLE))))
  .filter((name) => /^use[A-Z]/.test(name))
  .sort();

const missing = hooks.filter((name) => !(name in budgets.hooks));
if (missing.length > 0 && !measureOnly) {
  throw new Error(
    `No size budget for: ${missing.join(", ")}.\nRun \`pnpm size:update\` to add them to ${BUDGETS}, then commit the file.`
  );
}

if (budgets.testing === undefined && !measureOnly) {
  throw new Error(
    `No size budget for the testing entry.\nRun \`pnpm size:update\` to add it to ${BUDGETS}, then commit the file.`
  );
}

const stale = Object.keys(budgets.hooks).filter(
  (name) => !hooks.includes(name)
);
if (stale.length > 0 && !measureOnly) {
  throw new Error(
    `${BUDGETS} has budgets for hooks that are no longer exported: ${stale.join(", ")}.\nRun \`pnpm size:update\` to remove them, then commit the file.`
  );
}

/** Options shared by every check. */
const shared = {
  path: BUNDLE,
  gzip: true,
  // React is a peer dependency, so it isn't part of the package's size.
  ignore: ["react", "react-dom"],
};

export default [
  {
    ...shared,
    name: "bundle (all hooks)",
    import: "*",
    limit: budgets.bundle ?? PLACEHOLDER_LIMIT,
  },
  {
    ...shared,
    path: TESTING_BUNDLE,
    name: "testing (all helpers)",
    import: "*",
    limit: budgets.testing ?? PLACEHOLDER_LIMIT,
  },
  ...hooks.map((name) => ({
    ...shared,
    name,
    import: `{ ${name} }`,
    limit: budgets.hooks[name] ?? PLACEHOLDER_LIMIT,
  })),
];
