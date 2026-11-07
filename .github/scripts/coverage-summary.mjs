/**
 * @file Prints a Markdown coverage report for the GitHub Actions job summary.
 *
 * The PR check runs the test suite with coverage (`npm run coverage`), which
 * makes Vitest write `coverage/coverage-summary.json` through its
 * `json-summary` reporter. This script reads that file and prints a report to
 * stdout, which the workflow appends to the job summary:
 *
 * ```sh
 * node .github/scripts/coverage-summary.mjs >> "$GITHUB_STEP_SUMMARY"
 * ```
 *
 * The report contains:
 *
 * - a one-line verdict saying whether every threshold is met;
 * - a table of the total lines, statements, functions and branches coverage,
 *   each compared against its threshold;
 * - a collapsible table of the files that are not fully covered, least covered
 *   (by lines) first. It is left out when every file is at 100%.
 *
 * The thresholds come from `tests/coverage-thresholds.json`, the same file
 * `vitest.config.ts` uses to fail the run, so the report and the check always
 * agree. This script only reports: it always exits with code 0 and never fails
 * the job itself. When there is no coverage file (for example, an earlier step
 * failed before the tests ran), it prints a short notice instead.
 *
 * Run it locally after `npm run coverage` to preview the report:
 *
 * ```sh
 * npm run coverage && node .github/scripts/coverage-summary.mjs
 * ```
 *
 * It uses only Node.js built-ins and needs Node 20.11 or later for
 * `import.meta.dirname`.
 */
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

/**
 * Coverage for one metric, as written by Vitest's `json-summary` reporter.
 *
 * @typedef {object} MetricCoverage
 * @property {number} total - Number of items (lines, statements, functions or branches).
 * @property {number} covered - Number of those items the tests executed.
 * @property {number} skipped - Number of items excluded from coverage.
 * @property {number} pct - Covered items as a percentage of `total`, from 0 to 100.
 */

/**
 * Coverage of every metric for one file, or for all files combined.
 *
 * @typedef {object} FileCoverage
 * @property {MetricCoverage} lines - Line coverage.
 * @property {MetricCoverage} statements - Statement coverage.
 * @property {MetricCoverage} functions - Function coverage.
 * @property {MetricCoverage} branches - Branch coverage.
 */

/**
 * The parsed `coverage/coverage-summary.json` file. `total` holds the combined
 * coverage; every other key is a file's absolute path.
 *
 * @typedef {{ total: FileCoverage } & Record<string, FileCoverage>} CoverageSummary
 */

/**
 * One of the four metrics the report covers.
 *
 * @typedef {"lines" | "statements" | "functions" | "branches"} MetricKey
 */

/**
 * Minimum percentage per metric, as stored in `tests/coverage-thresholds.json`.
 * A metric without a threshold is reported but never marked as failing.
 *
 * @typedef {Partial<Record<MetricKey, number>>} CoverageThresholds
 */

/**
 * A rendered row of the totals table and whether its metric meets its
 * threshold.
 *
 * @typedef {object} TotalRow
 * @property {boolean} passed - `true` if the metric meets its threshold or has none.
 * @property {string} row - The Markdown table row for the metric.
 */

/**
 * A file that is not fully covered, with its path relative to the repository.
 *
 * @typedef {object} PartialFile
 * @property {string} file - Path relative to the repository root, such as `src/hooks/use-api.ts`.
 * @property {FileCoverage} data - The file's coverage.
 */

/** Absolute path of the repository root (two levels above this script). */
const ROOT = resolve(import.meta.dirname, "../..");

/** Where Vitest's `json-summary` reporter writes its output. */
const SUMMARY_PATH = resolve(ROOT, "coverage/coverage-summary.json");

/** The thresholds file shared with `vitest.config.ts`. */
const THRESHOLDS_PATH = resolve(ROOT, "tests/coverage-thresholds.json");

/**
 * The metrics in the order they appear in both tables, as
 * `[display label, summary key]` pairs.
 *
 * @type {ReadonlyArray<readonly [string, MetricKey]>}
 */
const METRICS = [
  ["Lines", "lines"],
  ["Statements", "statements"],
  ["Functions", "functions"],
  ["Branches", "branches"],
];

/**
 * Reads and parses a JSON file.
 *
 * @param {string} path - Absolute path of the file.
 * @returns {any} The parsed contents.
 */
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

/**
 * Formats a percentage with two decimals, for example `98.89%`.
 *
 * @param {number} value - A percentage from 0 to 100.
 * @returns {string} The formatted percentage.
 */
const formatPercent = (value) => `${value.toFixed(2)}%`;

/**
 * Builds one row of the totals table per metric, comparing each total against
 * its threshold.
 *
 * @param {FileCoverage} total - The combined coverage of all files.
 * @param {CoverageThresholds} thresholds - The minimum percentage per metric.
 * @returns {TotalRow[]} The rows, in {@link METRICS} order.
 */
const buildTotalRows = (total, thresholds) =>
  METRICS.map(([label, key]) => {
    const { pct, covered, total: count } = total[key];
    const threshold = thresholds[key];
    const passed = threshold === undefined || pct >= threshold;
    const thresholdCell = threshold === undefined ? "–" : `${threshold}%`;

    return {
      passed,
      row: `| ${label} | ${formatPercent(pct)} (${covered}/${count}) | ${thresholdCell} | ${
        passed ? "✅" : "❌"
      } |`,
    };
  });

/**
 * Finds the files where any metric is below 100%.
 *
 * @param {CoverageSummary} summary - The parsed coverage summary.
 * @returns {PartialFile[]} The files, sorted by line coverage, lowest first.
 */
const findPartialFiles = (summary) =>
  Object.entries(summary)
    .filter(([file]) => file !== "total")
    .map(([file, data]) => ({ file: relative(ROOT, file), data }))
    .filter(({ data }) => METRICS.some(([, key]) => data[key].pct < 100))
    .sort((a, b) => a.data.lines.pct - b.data.lines.pct);

/**
 * Renders the collapsible table of files that are not fully covered.
 *
 * @param {PartialFile[]} files - The files to list; must not be empty.
 * @returns {string[]} The Markdown lines of the `<details>` block.
 */
const renderPartialFiles = (files) => [
  "",
  `<details><summary>${files.length} file${
    files.length === 1 ? "" : "s"
  } not fully covered</summary>`,
  "",
  "| File | Lines | Statements | Functions | Branches |",
  "| --- | --- | --- | --- | --- |",
  ...files.map(
    ({ file, data }) =>
      `| \`${file}\` | ${METRICS.map(([, key]) =>
        formatPercent(data[key].pct)
      ).join(" | ")} |`
  ),
  "",
  "</details>",
];

/**
 * Renders the full report: the verdict, the totals table and, when some files
 * are not fully covered, the per-file table.
 *
 * @param {CoverageSummary} summary - The parsed coverage summary.
 * @param {CoverageThresholds} thresholds - The minimum percentage per metric.
 * @returns {string} The report as Markdown.
 */
const renderReport = (summary, thresholds) => {
  const totalRows = buildTotalRows(summary.total, thresholds);
  const partialFiles = findPartialFiles(summary);

  const lines = [
    "## Coverage",
    "",
    totalRows.every(({ passed }) => passed)
      ? "All coverage thresholds are met."
      : "**Coverage is below the threshold.** See ❌ below.",
    "",
    "| Metric | Coverage | Threshold | |",
    "| --- | --- | --- | --- |",
    ...totalRows.map(({ row }) => row),
  ];

  if (partialFiles.length > 0) {
    lines.push(...renderPartialFiles(partialFiles));
  }

  return lines.join("\n");
};

if (existsSync(SUMMARY_PATH)) {
  console.log(renderReport(readJson(SUMMARY_PATH), readJson(THRESHOLDS_PATH)));
} else {
  console.log("## Coverage\n\nNo coverage report was produced.");
}
