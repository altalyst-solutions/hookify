import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterEach, describe, expect, it } from "vitest";

/** The built command, as `npx @altalyst/hookify-mcp` runs it. */
const BIN = resolve(import.meta.dirname, "../dist/bin.js");

/** Clients to close after each test. */
const clients: Client[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) await client.close();
});

// Runs the published entry point in a child process with the same Node.js
// that runs the tests, so the Node 22 CI job checks the shipped files on 22.
describe("hookify-mcp command", () => {
  it("is built", () => {
    expect(existsSync(BIN), `${BIN} is missing; run pnpm build`).toBe(true);
  });

  it("serves the tools over stdio", async () => {
    const client = new Client({ name: "test", version: "1.0.0" });
    clients.push(client);
    await client.connect(
      new StdioClientTransport({ command: process.execPath, args: [BIN] })
    );

    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "find_hook",
      "get_hook",
      "list_hooks",
    ]);

    const result = await client.callTool({
      name: "find_hook",
      arguments: { query: "copy text to clipboard" },
    });
    const [block] = result.content as { type: string; text: string }[];
    expect(block.text).toMatch(/^1\. useClipboard \(best match\)/m);
  });
});
