/**
 * @file Maintains `packages/hookify/size-budgets.json`.
 *
 * `pnpm size` compares the gzipped size of the bundle and of every hook with
 * a budget in that file. This script keeps the file in step with the library
 * so contributors don't edit it by hand. Run it after `pnpm build`:
 *
 * ```sh
 * pnpm size:update                 # add new hooks, remove deleted ones
 * pnpm size:update useDebounce     # also reset a hook's budget to its current size
 * pnpm size:update bundle          # also reset the whole-package budget
 * pnpm size:update --all           # reset every budget
 * ```
 *
 * A budget is the measured size plus {@link HEADROOM}, rounded up to the next
 * {@link STEP} bytes. Budgets that already exist are never changed unless they
 * are named, so raising one is always a deliberate change that shows up in the
 * pull request diff. The script prints the budgets that are currently
 * exceeded, so it is safe to run when `pnpm size` fails: it tells you which
 * hooks to reset.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** Absolute path of the repository root (two levels above this script). */
const ROOT = resolve(import.meta.dirname, "../..");

/** Absolute path of the budgets file. */
const BUDGETS = resolve(ROOT, "packages/hookify/size-budgets.json");

/** The name `.size-limit.mjs` gives to the whole-package check. */
const BUNDLE_CHECK = "bundle (all hooks)";

/** The extra room a new budget leaves above the measured size, as a ratio. */
const HEADROOM = 1.1;

/** Budgets are rounded up to a multiple of this many bytes. */
const STEP = 10;

/**
 * Turns a measured size into a budget.
 *
 * @param size - The measured gzipped size in bytes.
 * @returns The budget as a string such as `"750 B"`.
 */
const toBudget = (size) => `${Math.ceil((size * HEADROOM) / STEP) * STEP} B`;

/**
 * Parses a budget such as `"750 B"` back into bytes.
 *
 * @param budget - The budget string.
 * @returns The number of bytes.
 */
const toBytes = (budget) => parseInt(budget, 10);

/**
 * Measures the bundle and every hook with the same config that `pnpm size`
 * uses, in a mode that doesn't require budgets to exist.
 *
 * @returns One `{ name, size }` entry for each check.
 */
const measure = () => {
  const result = spawnSync("pnpm", ["exec", "size-limit", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, SIZE_LIMIT_MEASURE: "1" },
  });

  try {
    return JSON.parse(result.stdout);
  } catch {
    process.stderr.write(result.stderr || result.stdout);
    throw new Error(
      "size-limit didn't report any sizes. Run `pnpm build` first."
    );
  }
};

/** Runs the update and reports what changed. */
const main = () => {
  const args = process.argv.slice(2);
  const resetAll = args.includes("--all");
  const reset = new Set(args.filter((arg) => arg !== "--all"));

  const current = existsSync(BUDGETS)
    ? JSON.parse(readFileSync(BUDGETS, "utf8"))
    : { hooks: {} };
  const sizes = measure();

  const hookSizes = Object.fromEntries(
    sizes
      .filter((row) => row.name !== BUNDLE_CHECK)
      .map((row) => [row.name, row.size])
  );
  const bundleSize = sizes.find((row) => row.name === BUNDLE_CHECK)?.size;

  const unknown = [...reset].filter(
    (name) => name !== "bundle" && !(name in hookSizes)
  );
  if (unknown.length > 0) {
    throw new Error(
      `Unknown hook(s): ${unknown.join(", ")}. Hooks are: ${Object.keys(hookSizes).join(", ")}.`
    );
  }

  const added = [];
  const resets = [];
  const exceeded = [];
  const hooks = {};

  for (const name of Object.keys(hookSizes).sort()) {
    const existing = current.hooks?.[name];
    if (existing === undefined) {
      hooks[name] = toBudget(hookSizes[name]);
      added.push(name);
    } else if (resetAll || reset.has(name)) {
      hooks[name] = toBudget(hookSizes[name]);
      if (hooks[name] !== existing)
        resets.push(`${name}: ${existing} -> ${hooks[name]}`);
    } else {
      hooks[name] = existing;
      if (hookSizes[name] > toBytes(existing)) {
        exceeded.push(`${name}: ${hookSizes[name]} B > ${existing}`);
      }
    }
  }

  const removed = Object.keys(current.hooks ?? {}).filter(
    (name) => !(name in hookSizes)
  );

  let bundle = current.bundle;
  if (bundle === undefined || resetAll || reset.has("bundle")) {
    const next = toBudget(bundleSize);
    if (bundle !== undefined && next !== bundle)
      resets.push(`bundle: ${bundle} -> ${next}`);
    if (bundle === undefined) added.push("bundle");
    bundle = next;
  } else if (bundleSize > toBytes(bundle)) {
    exceeded.push(`bundle: ${bundleSize} B > ${bundle}`);
  }

  writeFileSync(BUDGETS, `${JSON.stringify({ bundle, hooks }, null, 2)}\n`);

  const report = (label, items) => {
    if (items.length > 0)
      console.log(
        `${label}:\n${items.map((item) => `  - ${item}`).join("\n")}`
      );
  };
  report("Added", added);
  report("Removed", removed);
  report("Reset", resets);
  report(
    "Over budget (run `pnpm size:update <name>` to raise a budget on purpose)",
    exceeded
  );

  if (added.length + removed.length + resets.length === 0) {
    console.log("size-budgets.json is up to date.");
  }
  process.exitCode = exceeded.length > 0 ? 1 : 0;
};

main();
