import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";

import { hooksData } from "../src/data.ts";
import { createServer, type CreateServerOptions } from "../src/server.ts";

/** Clients and temp directories to clean up after each test. */
const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

/**
 * Connects a client to a fresh server over an in-memory transport.
 *
 * @param options - Options for the server.
 * @returns The connected client.
 */
const connect = async (options?: CreateServerOptions) => {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createServer(options);
  const client = new Client({ name: "test", version: "1.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  cleanups.push(() => client.close());
  return client;
};

/**
 * Calls a tool and returns its text and error flag.
 *
 * @param client - A connected client.
 * @param name - The tool name.
 * @param args - The tool arguments.
 * @returns The first text block and whether the result is an error.
 */
const call = async (
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
) => {
  const result = await client.callTool({ name, arguments: args });
  const [block] = result.content as { type: string; text: string }[];
  return { text: block.text, isError: result.isError === true };
};

describe("hookify MCP server", () => {
  it("offers three read-only tools", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "find_hook",
      "get_hook",
      "list_hooks",
    ]);
    for (const tool of tools) {
      expect(tool.annotations, tool.name).toMatchObject({
        readOnlyHint: true,
        openWorldHint: false,
      });
    }
  });

  describe("list_hooks", () => {
    it("lists every current hook once, grouped by category", async () => {
      const { text } = await call(await connect(), "list_hooks");
      for (const hook of hooksData.hooks.filter((entry) => !entry.deprecated)) {
        expect(text.match(new RegExp(`^- ${hook.name}:`, "gm"))).toHaveLength(
          1
        );
      }
      expect(text).toContain("## Timing (debounce, throttle, timers) (timing)");
      expect(text).not.toContain("- useDebounce:");
      expect(text).toMatch(/2 deprecated hooks are hidden/);
    });

    it("includes deprecated hooks with their replacement when asked", async () => {
      const { text } = await call(await connect(), "list_hooks", {
        includeDeprecated: true,
      });
      expect(text).toMatch(
        /- useDebounce: .*Deprecated: use useDebouncedCallback\./
      );
      expect(text).not.toMatch(/hidden/);
    });

    it("filters by category", async () => {
      const { text } = await call(await connect(), "list_hooks", {
        category: "async",
      });
      expect(text).toMatch(/3 hooks in "async"/);
      expect(text).toContain("- useApi:");
      expect(text).not.toContain("- useDebouncedValue:");
    });

    it("rejects an unknown category", async () => {
      const result = await call(await connect(), "list_hooks", {
        category: "network",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("get_hook", () => {
    it("returns the signature, parameters, types and an example", async () => {
      const { text, isError } = await call(await connect(), "get_hook", {
        name: "useDebouncedCallback",
      });
      expect(isError).toBe(false);
      expect(text).toContain("# useDebouncedCallback");
      expect(text).toContain(
        'import { useDebouncedCallback } from "@altalyst/hookify";'
      );
      expect(text).toContain("useDebouncedCallback<T extends");
      expect(text).toContain("- `delay`: The debounce delay in milliseconds.");
      expect(text).toContain("### UseDebouncedCallbackOptions");
      expect(text).toContain("- `leading?: boolean`");
      expect(text).toContain("## When to use it");
      expect(text).toMatch(/## Example\n```tsx\n/);
      expect(text).toContain(
        "https://altalyst-solutions.github.io/hookify/hooks/use-debounced-callback"
      );
    });

    it("accepts the docs slug", async () => {
      const { text } = await call(await connect(), "get_hook", {
        name: "use-debounced-value",
      });
      expect(text).toContain("# useDebouncedValue");
    });

    it("points a deprecated hook at its replacement", async () => {
      const { text } = await call(await connect(), "get_hook", {
        name: "useThrottle",
      });
      expect(text).toMatch(
        /\*\*Deprecated\.\*\* Use useThrottledValue instead\./
      );
    });

    it("suggests close names for an unknown hook, as an error", async () => {
      const { text, isError } = await call(await connect(), "get_hook", {
        name: "useDebouncedValu",
      });
      expect(isError).toBe(true);
      expect(text).toMatch(/Did you mean useDebouncedValue/);
    });
  });

  describe("find_hook", () => {
    it("recommends hooks with the use case they fit", async () => {
      const { text } = await call(await connect(), "find_hook", {
        query: "close a dropdown when clicking outside",
      });
      expect(text).toMatch(/^1\. useOutsideClick \(best match\)/m);
      expect(text).toMatch(/Fits: /);
      expect(text).toContain('Call get_hook with "useOutsideClick"');
    });

    it("says when nothing matches", async () => {
      const { text } = await call(await connect(), "find_hook", {
        query: "make me a coffee",
      });
      expect(text).toMatch(/^No hook matches "make me a coffee"/);
    });

    it("respects the limit and rejects one out of range", async () => {
      const client = await connect();
      const { text } = await call(client, "find_hook", {
        query: "element",
        limit: 1,
      });
      expect(text.match(/^\d+\. /gm)).toHaveLength(1);
      const tooMany = await call(client, "find_hook", {
        query: "element",
        limit: 50,
      });
      expect(tooMany.isError).toBe(true);
    });
  });

  describe("version note", () => {
    /**
     * Creates a project with a given hookify version installed.
     *
     * @param version - The installed version.
     * @returns The project directory.
     */
    const projectWith = (version: string) => {
      const dir = mkdtempSync(join(tmpdir(), "hookify-mcp-"));
      cleanups.push(() => rmSync(dir, { recursive: true }));
      writeFileSync(join(dir, "package.json"), "{}");
      const pkg = join(dir, "node_modules/@altalyst/hookify");
      mkdirSync(pkg, { recursive: true });
      writeFileSync(
        join(pkg, "package.json"),
        JSON.stringify({
          name: "@altalyst/hookify",
          version,
          exports: { "./package.json": "./package.json" },
        })
      );
      return dir;
    };

    it("starts every response with a note when the project's hookify differs", async () => {
      const client = await connect({ cwd: projectWith("0.1.0") });
      for (const [tool, args] of [
        ["list_hooks", {}],
        ["get_hook", { name: "useApi" }],
        ["find_hook", { query: "fetch data" }],
      ] as const) {
        const { text } = await call(client, tool, args);
        expect(text, tool).toMatch(
          /^Note: this project has @altalyst\/hookify 0\.1\.0/
        );
      }
    });

    it("adds no note when the versions match", async () => {
      const client = await connect({
        cwd: projectWith(hooksData.hookifyVersion),
      });
      const { text } = await call(client, "list_hooks");
      expect(text).not.toMatch(/^Note:/);
    });
  });
});
