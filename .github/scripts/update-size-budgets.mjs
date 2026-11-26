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
 * pnpm size:update testing         # also reset the testing entry's budget
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

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { measureSizes } from "./measure-sizes.mjs";

/** Absolute path of the repository root (two levels above this script). */
const ROOT = resolve(import.meta.dirname, "../..");

/** Absolute path of the budgets file. */
const BUDGETS = resolve(ROOT, "packages/hookify/size-budgets.json");

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

/** Runs the update and reports what changed. */
const main = () => {
  const args = process.argv.slice(2);
  const resetAll = args.includes("--all");
  const reset = new Set(args.filter((arg) => arg !== "--all"));

  const current = existsSync(BUDGETS)
    ? JSON.parse(readFileSync(BUDGETS, "utf8"))
    : { hooks: {} };
  const {
    bundle: bundleSize,
    testing: testingSize,
    hooks: hookSizes,
  } = measureSizes();

  const unknown = [...reset].filter(
    (name) => name !== "bundle" && name !== "testing" && !(name in hookSizes)
  );
  if (unknown.length > 0) {
    throw new Error(
      `Unknown hook(s): ${unknown.join(", ")}. Hooks are: ${Object.keys(hookSizes).join(", ")}, plus bundle and testing.`
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

  /**
   * Works out the budget of one of the whole-entry checks.
   *
   * @param name - `bundle` or `testing`.
   * @param size - Its measured size in bytes.
   * @returns The budget to keep or write.
   */
  const entryBudget = (name, size) => {
    const existing = current[name];
    if (existing === undefined || resetAll || reset.has(name)) {
      const next = toBudget(size);
      if (existing !== undefined && next !== existing)
        resets.push(`${name}: ${existing} -> ${next}`);
      if (existing === undefined) added.push(name);
      return next;
    }
    if (size > toBytes(existing)) {
      exceeded.push(`${name}: ${size} B > ${existing}`);
    }
    return existing;
  };

  const bundle = entryBudget("bundle", bundleSize);
  const testing = entryBudget("testing", testingSize);

  writeFileSync(
    BUDGETS,
    `${JSON.stringify({ bundle, testing, hooks }, null, 2)}\n`
  );

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
