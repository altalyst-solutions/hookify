/**
 * @file Generates the size data that the docs site shows.
 *
 * Measures the gzipped size of the whole bundle and of every hook, the same
 * way `pnpm size` does, and writes two files that are git-ignored and rebuilt
 * on every docs build:
 *
 * - `docs-site/src/data/hook-sizes.json`: read by the docs site to show each
 *   hook's size on its page and on the hooks index.
 * - `docs-site/static/size-badge.json`: a Shields.io endpoint badge for the
 *   README, published with the docs at `/size-badge.json`. The README points at
 *   the `next` channel's copy, which is rebuilt on every merge to main, because
 *   the stable one only changes when the library is released.
 *
 * `pnpm docs:build` runs it after building the library:
 *
 * ```sh
 * pnpm docs:sizes
 * ```
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { measureSizes } from "./measure-sizes.mjs";

/** Absolute path of the repository root (two levels above this script). */
const ROOT = resolve(import.meta.dirname, "../..");

/** Where the docs site reads each hook's size. */
const SIZES_FILE = resolve(ROOT, "docs-site/src/data/hook-sizes.json");

/** Where the README badge's data is published with the docs. */
const BADGE_FILE = resolve(ROOT, "docs-site/static/size-badge.json");

/**
 * Formats a size in bytes the way `size-limit` does.
 *
 * @param size - The size in bytes.
 * @returns The size such as `126 B` or `8.7 kB`.
 */
const formatSize = (size) =>
  size < 1000 ? `${size} B` : `${parseFloat((size / 1000).toFixed(1))} kB`;

/**
 * Writes a JSON file, creating its folder if needed.
 *
 * @param file - The absolute path of the file.
 * @param data - The value to write.
 */
const writeJson = (file, data) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};

/** Measures the sizes and writes the files. */
const main = () => {
  const { bundle, hooks } = measureSizes();

  // Hook pages are named after the hook in kebab case, such as use-x.mdx.
  const pageName = (hook) =>
    hook.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  const withoutPage = Object.keys(hooks).filter(
    (hook) =>
      !existsSync(resolve(ROOT, `docs-site/docs/hooks/${pageName(hook)}.mdx`))
  );
  if (withoutPage.length > 0) {
    console.warn(
      `No docs page found for: ${withoutPage.join(", ")}. Their sizes won't show on the site.`
    );
  }

  writeJson(SIZES_FILE, { bundle, hooks });
  writeJson(BADGE_FILE, {
    schemaVersion: 1,
    label: "gzipped, all hooks",
    message: formatSize(bundle),
    color: "3ECC5F",
  });

  console.log(
    `Wrote sizes for ${Object.keys(hooks).length} hooks (whole package: ${formatSize(bundle)}).`
  );
};

main();
