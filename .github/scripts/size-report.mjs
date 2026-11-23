/**
 * @file Renders a Markdown table that compares two size measurements.
 *
 * The PR check measures the gzipped size of the whole bundle and of every hook
 * twice, once for the pull request and once for the base branch, with
 * `size-limit --json`. This script compares the two reports and prints the
 * result as Markdown, to be appended to the job summary:
 *
 * ```sh
 * node .github/scripts/size-report.mjs base.json head.json >> "$GITHUB_STEP_SUMMARY"
 * ```
 *
 * It only reports, so it exits with 0 even when a report is missing or
 * unreadable, and says so in the output instead.
 */

import { readFileSync } from "node:fs";

/** The name `.size-limit.mjs` gives to the whole-package check. */
const BUNDLE_CHECK = "bundle (all hooks)";

/**
 * Reads a `size-limit --json` report.
 *
 * @param file - The path of the report.
 * @returns A map from check name to size in bytes, or `null` if the file
 *   can't be read or isn't a report.
 */
const readSizes = (file) => {
  try {
    const rows = JSON.parse(readFileSync(file, "utf8"));
    return new Map(rows.map((row) => [row.name, row.size]));
  } catch {
    return null;
  }
};

/**
 * Formats a size in bytes.
 *
 * @param size - The size, or `undefined` when there is none.
 * @returns The size such as `1,234 B`, or an em dash.
 */
const formatSize = (size) =>
  size === undefined ? "—" : `${size.toLocaleString("en-US")} B`;

/**
 * Formats the change between two sizes.
 *
 * @param before - The size on the base branch, if the check existed there.
 * @param after - The size in the pull request, if the check exists there.
 * @returns A string such as `+12 B (+3.1%)`, `new` or `removed`.
 */
const formatChange = (before, after) => {
  if (before === undefined) return "new";
  if (after === undefined) return "removed";
  const delta = after - before;
  if (delta === 0) return "no change";
  const percent = ((Math.abs(delta) / before) * 100).toFixed(1);
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${Math.abs(delta).toLocaleString("en-US")} B (${sign}${percent}%)`;
};

/**
 * Builds a Markdown table.
 *
 * @param header - The column titles.
 * @param rows - The rows, each an array of cells.
 * @returns The table as Markdown.
 */
const table = (header, rows) =>
  [
    `| ${header.join(" | ")} |`,
    `| ${header.map((_, index) => (index === 0 ? "---" : "---:")).join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");

/** Compares the reports and prints the Markdown. */
const main = () => {
  const [baseFile, headFile] = process.argv.slice(2);
  const base = readSizes(baseFile);
  const head = readSizes(headFile);

  console.log("## Bundle size\n");

  if (!base || !head) {
    console.log(
      `Couldn't compare sizes because the ${!base ? "base branch" : "pull request"} report is missing or unreadable. See the log of the measuring step.`
    );
    return;
  }

  console.log(
    "Gzipped size of what a consumer bundles, compared with the base branch. This job only reports; the budgets are enforced by `pnpm size` in the PR check.\n"
  );

  console.log(
    table(
      ["", "Before", "After", "Change"],
      [
        [
          "Whole package",
          formatSize(base.get(BUNDLE_CHECK)),
          formatSize(head.get(BUNDLE_CHECK)),
          formatChange(base.get(BUNDLE_CHECK), head.get(BUNDLE_CHECK)),
        ],
      ]
    )
  );

  const names = [...new Set([...base.keys(), ...head.keys()])].filter(
    (name) => name !== BUNDLE_CHECK
  );
  const changed = names
    .filter((name) => base.get(name) !== head.get(name))
    .sort(
      (a, b) =>
        Math.abs((head.get(b) ?? 0) - (base.get(b) ?? 0)) -
          Math.abs((head.get(a) ?? 0) - (base.get(a) ?? 0)) ||
        a.localeCompare(b)
    );

  if (changed.length === 0) {
    console.log(`\nNo hook changed size (${names.length} hooks checked).`);
    return;
  }

  console.log(
    `\n### Hooks that changed (${changed.length} of ${names.length})\n`
  );
  console.log(
    table(
      ["Hook", "Before", "After", "Change"],
      changed.map((name) => [
        `\`${name}\``,
        formatSize(base.get(name)),
        formatSize(head.get(name)),
        formatChange(base.get(name), head.get(name)),
      ])
    )
  );
};

main();
