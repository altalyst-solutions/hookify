import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import generated from "./generated/hooks.json" with { type: "json" };
import type { HookEntry, HooksData } from "./types.ts";

/** The hook data generated at build time by `scripts/build-data.ts`. */
export const hooksData = generated as HooksData;

/**
 * Normalizes a hook name for lookup.
 *
 * @param name - A hook name in any common spelling: `useDebouncedValue`,
 *   `usedebouncedvalue` or the docs slug `use-debounced-value`.
 * @returns The name lowercased, without dashes, underscores or spaces.
 */
const normalize = (name: string) => name.toLowerCase().replace(/[-_\s]/g, "");

/**
 * Finds a hook by name.
 *
 * @param name - The hook name or docs slug, case-insensitive.
 * @param data - The data to search. Default is {@link hooksData}.
 * @returns The hook, or `undefined` when no hook has that name.
 */
export const findHook = (
  name: string,
  data: HooksData = hooksData
): HookEntry | undefined => {
  const wanted = normalize(name);
  return data.hooks.find((hook) => normalize(hook.name) === wanted);
};

/**
 * Computes the edit distance between two strings.
 *
 * @param a - The first string.
 * @param b - The second string.
 * @returns How many single-character insertions, deletions or substitutions
 *   turn `a` into `b`.
 */
const editDistance = (a: string, b: string) => {
  /** Distances for the previous row of the dynamic-programming table. */
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
};

/**
 * Suggests the hook names closest to a name that matched nothing.
 *
 * @param name - The name that was not found.
 * @param limit - How many names to suggest. Default is `3`.
 * @param data - The data to search. Default is {@link hooksData}.
 * @returns Up to `limit` hook names, closest first.
 */
export const suggestNames = (
  name: string,
  limit = 3,
  data: HooksData = hooksData
) => {
  const wanted = normalize(name);
  return data.hooks
    .map((hook) => ({
      name: hook.name,
      distance: editDistance(wanted, normalize(hook.name)),
    }))
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((match) => match.name);
};

/**
 * Reads the `@altalyst/hookify` version installed in a project.
 *
 * It looks for `node_modules/@altalyst/hookify/package.json` in the project
 * directory and each of its parents, the way Node resolves packages, but
 * deliberately not through `require.resolve`: that also searches `NODE_PATH`,
 * which pnpm's command shims point at their own `node_modules`, so a server
 * started through `pnpm dlx` could report a hookify that isn't the project's.
 *
 * @param cwd - The project directory; the server's working directory, which
 *   agents set to the project they work in. Default is `process.cwd()`.
 * @returns The installed version, or `undefined` when the project doesn't
 *   depend on hookify or it can't be read.
 */
export const installedHookifyVersion = (
  cwd: string = process.cwd()
): string | undefined => {
  let dir = resolve(cwd);
  for (;;) {
    const path = join(dir, "node_modules/@altalyst/hookify/package.json");
    if (existsSync(path)) {
      try {
        const { version } = JSON.parse(readFileSync(path, "utf8")) as {
          version?: unknown;
        };
        return typeof version === "string" ? version : undefined;
      } catch {
        return undefined;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
};

/**
 * Explains a mismatch between the project's hookify and the data's.
 *
 * @param installed - The version installed in the project, if any.
 * @param documented - The version the data describes. Default is the
 *   generated data's version.
 * @returns A one-line note, or `undefined` when there is nothing to warn about.
 */
export const versionNote = (
  installed: string | undefined,
  documented: string = hooksData.hookifyVersion
) => {
  if (!installed || installed === documented) return undefined;
  return `Note: this project has @altalyst/hookify ${installed}, but these docs describe ${documented}. APIs may differ; update hookify, or run the @altalyst/hookify-mcp release that matches ${installed}.`;
};
