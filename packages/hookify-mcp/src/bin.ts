#!/usr/bin/env node
/**
 * The `hookify-mcp` command: serves the hookify MCP server over stdio.
 *
 * Agents start it with `npx -y @altalyst/hookify-mcp`. stdout carries the
 * protocol, so nothing here may write to it; diagnostics go to stderr.
 */

import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { createServer } from "./server.ts";

/** The running stdio connection. */
const handle = serveStdio(() => createServer());

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void handle.close();
  });
}
