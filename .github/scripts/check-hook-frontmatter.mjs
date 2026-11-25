/**
 * @file Checks the metadata on every hook docs page.
 *
 * Each `docs-site/docs/hooks/use-x.mdx` page describes one hook exported from
 * `packages/hookify/src/hooks/index.ts`. Its front matter carries structured
 * metadata that the docs site shows (the `description` on the hooks index
 * cards) and that `@altalyst/hookify-mcp` uses to recommend hooks. This script
 * fails when that metadata is missing or inconsistent, so a new hook can't
 * ship without it:
 *
 * ```sh
 * node .github/scripts/check-hook-frontmatter.mjs
 * ```
 *
 * It checks that:
 *
 * - every exported hook has a page, and every page has an exported hook;
 * - `title` is the hook's name (`use-debounced-value.mdx` → `useDebouncedValue`);
 * - `description` is one sentence of 20 to 160 characters ending with a period;
 * - `keywords` lists 2 to 8 unique, lowercase search terms;
 * - `category` is one of {@link CATEGORIES};
 * - `related` (optional) only names other existing hooks;
 * - `browserApis` lists the browser APIs the hook relies on (empty for none);
 * - `testing` (optional) only names helpers exported from
 *   `@altalyst/hookify/testing`, the fakes to use when testing the hook;
 * - a deprecated page sets `replacedBy` to an existing, non-deprecated hook;
 * - every other page has a `## When to use it` section with at least two
 *   bullets, which is where the use cases live (they are not repeated in the
 *   front matter);
 * - there are no unknown front matter keys, which catches typos.
 *
 * It prints every problem it finds, grouped by page, and exits with code 1 if
 * there are any.
 */

import { readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import { parse } from "yaml";

/** Absolute path of the repository root (two levels above this script). */
const ROOT = resolve(import.meta.dirname, "../..");

/** Directory holding one `.mdx` page per hook. */
const PAGES_DIR = resolve(ROOT, "docs-site/docs/hooks");

/** The library's hooks barrel file; each `export *` line is one hook. */
const HOOKS_INDEX = resolve(ROOT, "packages/hookify/src/hooks/index.ts");

/** Directory of the `@altalyst/hookify/testing` entry. */
const TESTING_DIR = resolve(ROOT, "packages/hookify/src/testing");

/**
 * Allowed values for `category`, with what belongs in each.
 *
 * @type {Record<string, string>}
 */
const CATEGORIES = {
  state: "Local, controlled, toggled, persisted or historical state",
  timing: "Debouncing, throttling, timers, intervals, rate limits and clocks",
  async: "Fetching data and running async work",
  dom: "Elements, events, sizes, visibility and scrolling",
  browser:
    "Browser features: clipboard, media queries, tabs, locks, page visibility",
  lifecycle: "Mount state and effect timing",
  refs: "Stable callbacks and latest-value refs",
};

/** Front matter keys Docusaurus uses that this script allows but doesn't check. */
const DOCUSAURUS_KEYS = new Set(["title", "sidebar_label", "sidebar_position"]);

/** Front matter keys this script checks. */
const METADATA_KEYS = new Set([
  "description",
  "keywords",
  "category",
  "related",
  "browserApis",
  "testing",
  "deprecated",
  "replacedBy",
]);

/** Shortest allowed `description`, in characters. */
const MIN_DESCRIPTION = 20;

/** Longest allowed `description`, in characters (the usual meta description limit). */
const MAX_DESCRIPTION = 160;

/**
 * Turns a page or file slug into the hook's name.
 *
 * @param {string} slug - Kebab-case slug, such as `use-debounced-value`.
 * @returns {string} The camelCase hook name, such as `useDebouncedValue`.
 */
const toHookName = (slug) =>
  slug.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

/**
 * Reads the hook slugs exported from the library's hooks barrel file.
 *
 * @returns {Set<string>} Slugs such as `use-api`, one per `export *` line.
 */
const readExportedSlugs = () => {
  const source = readFileSync(HOOKS_INDEX, "utf8");
  return new Set(
    [...source.matchAll(/export \* from "\.\/(use-[a-z-]+)";/g)].map(
      (match) => match[1]
    )
  );
};

/**
 * Reads the names exported from the `@altalyst/hookify/testing` entry.
 *
 * @returns {Set<string>} The `export const` names of every module that the
 *   entry's `index.ts` re-exports with `export * from "./module"`.
 */
const readTestingExports = () => {
  const index = readFileSync(resolve(TESTING_DIR, "index.ts"), "utf8");
  const names = new Set();
  for (const [, module] of index.matchAll(/export \* from "\.\/([a-z-]+)";/g)) {
    const source = readFileSync(resolve(TESTING_DIR, `${module}.ts`), "utf8");
    for (const [, name] of source.matchAll(/^export const (\w+)/gm)) {
      names.add(name);
    }
  }
  return names;
};

/**
 * Splits an `.mdx` page into its parsed front matter and its body.
 *
 * @param {string} source - The page's full text.
 * @returns {{ data: Record<string, unknown> | null, body: string }} The
 *   front matter (`null` when missing or invalid YAML) and the rest of the page.
 */
const splitPage = (source) => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!match) return { data: null, body: source };
  try {
    return { data: parse(match[1]) ?? {}, body: source.slice(match[0].length) };
  } catch {
    return { data: null, body: source.slice(match[0].length) };
  }
};

/**
 * Counts the bullets in a page's `## When to use it` section.
 *
 * @param {string} body - The page without its front matter.
 * @returns {number} The number of top-level `- ` bullets, or `-1` when the
 *   section is missing.
 */
const countUseCases = (body) => {
  const section = /^## When to use it\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(
    body
  );
  if (!section) return -1;
  return section[1].split("\n").filter((line) => line.startsWith("- ")).length;
};

/**
 * Checks that a value is an array of non-empty strings.
 *
 * @param {unknown} value - The value to check.
 * @returns {value is string[]} `true` when it is.
 */
const isStringList = (value) =>
  Array.isArray(value) &&
  value.every((item) => typeof item === "string" && item.trim() !== "");

/**
 * Checks one page's front matter and body.
 *
 * @param {string} slug - The page's slug, such as `use-api`.
 * @param {Record<string, unknown>} data - Its parsed front matter.
 * @param {string} body - The page without its front matter.
 * @param {Map<string, Record<string, unknown>>} pages - Every page's front
 *   matter, by hook name, for cross-page checks.
 * @param {Set<string>} testingExports - The names exported by the testing entry.
 * @returns {string[]} The problems found; empty when the page is valid.
 */
const checkPage = (slug, data, body, pages, testingExports) => {
  const problems = [];
  const name = toHookName(slug);

  for (const key of Object.keys(data)) {
    if (!DOCUSAURUS_KEYS.has(key) && !METADATA_KEYS.has(key)) {
      problems.push(`unknown front matter key \`${key}\``);
    }
  }

  if (data.title !== name) {
    problems.push(`\`title\` must be \`${name}\`, not \`${data.title}\``);
  }

  const { description } = data;
  if (typeof description !== "string") {
    problems.push("missing `description`");
  } else {
    if (
      description.length < MIN_DESCRIPTION ||
      description.length > MAX_DESCRIPTION
    ) {
      problems.push(
        `\`description\` is ${description.length} characters; keep it between ${MIN_DESCRIPTION} and ${MAX_DESCRIPTION}`
      );
    }
    if (!description.endsWith(".")) {
      problems.push("`description` must end with a period");
    }
    if (description.includes("\n")) {
      problems.push("`description` must be a single line");
    }
  }

  const { keywords } = data;
  if (!isStringList(keywords)) {
    problems.push("`keywords` must be a list of search terms");
  } else {
    if (keywords.length < 2 || keywords.length > 8) {
      problems.push(`\`keywords\` has ${keywords.length} terms; use 2 to 8`);
    }
    if (new Set(keywords).size !== keywords.length) {
      problems.push("`keywords` has duplicates");
    }
    const notLower = keywords.filter((term) => term !== term.toLowerCase());
    if (notLower.length > 0) {
      problems.push(`\`keywords\` must be lowercase: ${notLower.join(", ")}`);
    }
  }

  if (!Object.hasOwn(CATEGORIES, String(data.category))) {
    problems.push(
      `\`category\` must be one of: ${Object.keys(CATEGORIES).join(", ")}`
    );
  }

  if (data.related !== undefined) {
    if (!isStringList(data.related)) {
      problems.push("`related` must be a list of hook names");
    } else {
      for (const other of data.related) {
        if (other === name) problems.push("`related` lists the hook itself");
        else if (!pages.has(other))
          problems.push(`\`related\` names unknown hook \`${other}\``);
      }
    }
  }

  if (
    !Array.isArray(data.browserApis) ||
    !data.browserApis.every((api) => typeof api === "string" && api !== "")
  ) {
    problems.push(
      "`browserApis` must list the browser APIs it relies on (`[]` for none)"
    );
  }

  if (data.testing !== undefined) {
    if (!isStringList(data.testing)) {
      problems.push("`testing` must be a list of helper names");
    } else {
      if (new Set(data.testing).size !== data.testing.length) {
        problems.push("`testing` has duplicates");
      }
      for (const helper of data.testing) {
        if (!testingExports.has(helper)) {
          problems.push(
            `\`testing\` names \`${helper}\`, which \`@altalyst/hookify/testing\` doesn't export`
          );
        }
      }
    }
  }

  if (data.deprecated !== undefined && data.deprecated !== true) {
    problems.push("`deprecated` must be `true` or left out");
  }

  if (data.deprecated === true) {
    const replacement = pages.get(String(data.replacedBy));
    if (typeof data.replacedBy !== "string") {
      problems.push("a deprecated hook needs `replacedBy`");
    } else if (!replacement) {
      problems.push(`\`replacedBy\` names unknown hook \`${data.replacedBy}\``);
    } else if (replacement.deprecated === true) {
      problems.push(
        `\`replacedBy\` names deprecated hook \`${data.replacedBy}\``
      );
    }
  } else {
    if (data.replacedBy !== undefined) {
      problems.push("`replacedBy` is only for deprecated hooks");
    }
    const useCases = countUseCases(body);
    if (useCases === -1) {
      problems.push("missing a `## When to use it` section");
    } else if (useCases < 2) {
      problems.push(
        `\`## When to use it\` has ${useCases} bullet(s); list at least 2`
      );
    }
  }

  return problems;
};

/** Runs every check and reports the results. */
const main = () => {
  const exported = readExportedSlugs();
  const testingExports = readTestingExports();
  const files = readdirSync(PAGES_DIR).filter((file) => file.endsWith(".mdx"));
  const slugs = new Set(files.map((file) => basename(file, ".mdx")));

  /** Problems found, by page file (or `index.ts` for missing pages). */
  const report = new Map();
  const add = (where, problem) =>
    report.set(where, [...(report.get(where) ?? []), problem]);

  for (const slug of exported) {
    if (!slugs.has(slug))
      add(
        "packages/hookify/src/hooks/index.ts",
        `\`${toHookName(slug)}\` has no docs page (${slug}.mdx)`
      );
  }

  /** Parsed pages, by hook name. */
  const pages = new Map();
  /** Page bodies, by slug. */
  const bodies = new Map();
  for (const file of files) {
    const slug = basename(file, ".mdx");
    const { data, body } = splitPage(
      readFileSync(resolve(PAGES_DIR, file), "utf8")
    );
    if (!exported.has(slug)) add(file, "no hook with this name is exported");
    if (data === null) {
      add(file, "missing or invalid front matter");
      continue;
    }
    pages.set(toHookName(slug), data);
    bodies.set(slug, body);
  }

  for (const [slug, body] of bodies) {
    for (const problem of checkPage(
      slug,
      pages.get(toHookName(slug)),
      body,
      pages,
      testingExports
    )) {
      add(`${slug}.mdx`, problem);
    }
  }

  if (report.size === 0) {
    console.log(`All ${files.length} hook pages have valid metadata.`);
    return;
  }

  let count = 0;
  for (const [where, problems] of report) {
    console.error(`\n${where}`);
    for (const problem of problems) console.error(`  - ${problem}`);
    count += problems.length;
  }
  console.error(
    `\n${count} problem(s) in ${report.size} file(s). See CONTRIBUTING.md (Adding a new hook) for the fields.`
  );
  process.exitCode = 1;
};

main();
