import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Reads a JSON file from the package directory.
 *
 * @param name - The file name, such as `server.json`.
 * @returns The parsed JSON.
 */
const readJson = (name: string) =>
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, "..", name), "utf8")
  ) as Record<string, unknown>;

/** The npm package manifest. */
const pkg = readJson("package.json") as {
  name: string;
  version: string;
  mcpName: string;
};

/** The MCP Registry description of the server. */
const server = readJson("server.json") as {
  name: string;
  description: string;
  title?: string;
  version: string;
  packages: {
    registryType: string;
    identifier: string;
    version: string;
    transport: { type: string };
  }[];
};

// The registry rejects a server.json that doesn't match the npm package it
// points at, and the version must follow every release (synced by
// .github/scripts/sync-server-json.mjs in the root `version` script).
describe("server.json", () => {
  it("names the same server as package.json's mcpName", () => {
    expect(server.name).toBe(pkg.mcpName);
  });

  it("points at this npm package over stdio", () => {
    expect(server.packages).toHaveLength(1);
    expect(server.packages[0]).toMatchObject({
      registryType: "npm",
      identifier: pkg.name,
      transport: { type: "stdio" },
    });
  });

  it("has the package's version", () => {
    expect(server.version).toBe(pkg.version);
    expect(server.packages[0].version).toBe(pkg.version);
  });

  it("stays within the registry's length limits", () => {
    expect(server.description.length).toBeGreaterThan(0);
    expect(server.description.length).toBeLessThanOrEqual(100);
    expect(server.title?.length ?? 0).toBeLessThanOrEqual(100);
    expect(server.name).toMatch(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);
  });
});
