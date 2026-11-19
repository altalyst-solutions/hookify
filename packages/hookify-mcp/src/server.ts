import { createRequire } from "node:module";

import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

import {
  findHook,
  hooksData,
  installedHookifyVersion,
  suggestNames,
  versionNote,
} from "./data.ts";
import {
  formatHook,
  formatHookList,
  formatSearchResults,
  withNote,
} from "./format.ts";
import { searchHooks } from "./search.ts";
import type { HookCategory, HooksData } from "./types.ts";

/** This package's version, reported to clients during initialization. */
const { version: SERVER_VERSION } = createRequire(import.meta.url)(
  "../package.json"
) as { version: string };

/** Every category, for validating `list_hooks` input. */
const CATEGORIES = [
  "state",
  "timing",
  "async",
  "dom",
  "browser",
  "lifecycle",
  "refs",
] as const satisfies readonly HookCategory[];

/** All three tools only read bundled data: no side effects, no network. */
const READ_ONLY = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

/** Options for {@link createServer}. */
export interface CreateServerOptions {
  /** The hook data to serve. Default is the data generated at build time. */
  data?: HooksData;
  /**
   * The project directory, used to read its installed `@altalyst/hookify`
   * version and warn when it differs from the data's. Default is
   * `process.cwd()`.
   */
  cwd?: string;
}

/**
 * Wraps text in a tool result.
 *
 * @param text - The response text.
 * @param isError - Mark the result as an error the model can read and act on.
 *   Default is `false`.
 * @returns A tool result with one text block.
 */
const textResult = (text: string, isError = false) => ({
  content: [{ type: "text" as const, text }],
  ...(isError ? { isError: true } : {}),
});

/**
 * Creates the hookify MCP server with its three tools: `list_hooks`,
 * `get_hook` and `find_hook`.
 *
 * @param options - The data to serve and the project directory.
 * @returns A server ready to be connected to a transport.
 */
export const createServer = (options: CreateServerOptions = {}) => {
  const { data = hooksData, cwd } = options;
  const note = versionNote(installedHookifyVersion(cwd), data.hookifyVersion);
  const server = new McpServer({ name: "hookify", version: SERVER_VERSION });

  server.registerTool(
    "list_hooks",
    {
      title: "List hookify hooks",
      description:
        "List the React hooks in @altalyst/hookify, one line each, grouped by category. Use it to browse; use find_hook to search by use case.",
      inputSchema: z.object({
        category: z
          .enum(CATEGORIES)
          .optional()
          .describe("Only list hooks in this category."),
        includeDeprecated: z
          .boolean()
          .optional()
          .describe("Also list deprecated hooks. Default is false."),
      }),
      annotations: READ_ONLY,
    },
    async ({ category, includeDeprecated }) =>
      textResult(
        withNote(formatHookList(data, { category, includeDeprecated }), note)
      )
  );

  server.registerTool(
    "get_hook",
    {
      title: "Get a hookify hook",
      description:
        "Get everything needed to use one @altalyst/hookify hook correctly: its signature, parameters, option and return types with defaults, when to use it, behavior details and its docs link. Set includeAllExamples to true to return every documented example instead of only the first.",
      inputSchema: z.object({
        name: z
          .string()
          .min(1)
          .describe(
            "The hook name, such as useDebouncedValue (the docs slug use-debounced-value also works)."
          ),
        includeAllExamples: z
          .boolean()
          .optional()
          .describe(
            "Include every documented example instead of only the first. Default is false."
          ),
      }),
      annotations: READ_ONLY,
    },
    async ({ name, includeAllExamples }) => {
      const hook = findHook(name, data);
      if (!hook) {
        return textResult(
          `No hook named "${name}" in @altalyst/hookify ${data.hookifyVersion}. Did you mean ${suggestNames(name, 3, data).join(", ")}? Call find_hook to search by use case, or list_hooks to see them all.`,
          true
        );
      }
      return textResult(
        withNote(formatHook(hook, data, { includeAllExamples }), note)
      );
    }
  );

  server.registerTool(
    "find_hook",
    {
      title: "Find a hookify hook",
      description:
        'Recommend @altalyst/hookify hooks for a problem described in plain language, such as "debounce a search input" or "close a dropdown when clicking outside". Returns the best matches with the use case each one fits.',
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe("What you want to do, in plain language."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("How many hooks to return, 1 to 10. Default is 3."),
      }),
      annotations: READ_ONLY,
    },
    async ({ query, limit }) =>
      textResult(
        withNote(
          formatSearchResults(query, searchHooks(query, data, limit), data),
          note
        )
      )
  );

  return server;
};
