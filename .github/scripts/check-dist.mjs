/**
 * @file Checks the built `@altalyst/hookify` bundles.
 *
 * React Server Component frameworks, such as the Next.js App Router, only
 * accept hooks from modules that start with the `"use client"` directive.
 * Without it, importing hookify from a shared or server module fails, and
 * consumers have to write their own wrapper files. This script fails when
 * either bundle doesn't begin with the directive. Run it after `pnpm build`:
 *
 * ```sh
 * node .github/scripts/check-dist.mjs
 * ```
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Absolute path of the library's build output. */
const DIST = resolve(import.meta.dirname, "../../packages/hookify/dist");

/** The bundles that must start with the directive. */
const BUNDLES = ["hookify.js", "hookify.cjs"];

/** The directive, followed by its semicolon, as the first statement. */
const DIRECTIVE = /^"use client";/;

/** Runs the check and reports the result. */
const main = () => {
  const missing = BUNDLES.filter(
    (bundle) => !DIRECTIVE.test(readFileSync(resolve(DIST, bundle), "utf8"))
  );

  if (missing.length > 0) {
    console.error(
      `These bundles don't start with "use client", so React Server Component frameworks can't import hookify from shared modules:\n${missing
        .map((bundle) => `  - packages/hookify/dist/${bundle}`)
        .join(
          "\n"
        )}\n\nThe directive is added by the \`banner\` option in packages/hookify/vite.config.ts.`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`${BUNDLES.join(" and ")} start with "use client".`);
};

main();
