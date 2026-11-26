import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";

import {
  createAuditSummary,
  parseAuditJson,
  renderAuditSummary,
} from "./audit-summary.mjs";

const auditJson = (advisories) =>
  JSON.stringify({
    advisories,
    metadata: {
      vulnerabilities: Object.fromEntries(
        ["info", "low", "moderate", "high", "critical"].map((severity) => [
          severity,
          Object.values(advisories).filter(
            (advisory) => advisory.severity === severity
          ).length,
        ])
      ),
    },
  });

const advisory = (severity) => ({
  severity,
  module_name: "minimatch",
  vulnerable_versions: ">=7.0.0 <11.0.1",
  patched_versions: ">=11.0.1",
  url: "https://github.com/advisories/GHSA-g3hv-75wg-m249",
  findings: [{ paths: ["docs-site>typedoc>minimatch"] }],
});

const render = (advisories, threshold, exitCode) =>
  renderAuditSummary({
    audit: parseAuditJson(auditJson(advisories)),
    name: "library",
    directory: ".",
    threshold,
    exitCode,
  });

test("reports a clean audit and the configured scope and threshold", () => {
  const result = render({}, "moderate", 0);

  assert.equal(result.exitCode, 0);
  assert.match(result.markdown, /workspace root/);
  assert.match(result.markdown, /moderate and above/);
  assert.match(result.markdown, /includes docs-site dependencies/);
  assert.match(result.markdown, /No advisories found/);
});

test("marks findings below the threshold as non-blocking", () => {
  const result = render({ 1: advisory("moderate") }, "high", 1);

  assert.equal(result.exitCode, 0);
  assert.match(result.markdown, /none meet the threshold/);
  assert.match(result.markdown, /\| Non-blocking \| moderate \| minimatch \|/);
  assert.match(result.markdown, /minimatch/);
  assert.match(result.markdown, /docs-site>typedoc>minimatch/);
  assert.match(result.markdown, /Advisory/);
});

test("marks findings at the threshold as blocking", () => {
  const result = render({ 1: advisory("moderate") }, "moderate", 1);

  assert.equal(result.exitCode, 1);
  assert.match(result.markdown, /1 blocking finding at or above the threshold/);
  assert.match(result.markdown, /\| Blocking \| moderate \| minimatch \|/);
  assert.match(result.markdown, /Patched versions/);
});

test("distinguishes blocking and non-blocking findings in the same report", () => {
  const result = render(
    { 1: advisory("moderate"), 2: advisory("high") },
    "high",
    1
  );

  assert.equal(result.exitCode, 1);
  assert.match(result.markdown, /\| Blocking \| high \|/);
  assert.match(result.markdown, /\| Non-blocking \| moderate \|/);
});

test("collects and reports below-threshold findings in the workflow", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "hookify-audit-workflow-"));
  const pnpmPath = join(directory, "pnpm");
  const fullPath = join(directory, "full.json");
  const filteredPath = join(directory, "filtered.json");
  const jsonPath = join(directory, "audit.json");
  const stderrPath = join(directory, "audit.stderr");
  const outputPath = join(directory, "github-output");
  const files = [
    pnpmPath,
    fullPath,
    filteredPath,
    jsonPath,
    stderrPath,
    outputPath,
  ];
  t.after(() => {
    for (const file of files) {
      if (existsSync(file)) unlinkSync(file);
    }
    rmdirSync(directory);
  });

  const filtered = JSON.parse(auditJson({}));
  filtered.metadata.vulnerabilities.moderate = 1;
  writeFileSync(fullPath, auditJson({ 1: advisory("moderate") }));
  writeFileSync(filteredPath, JSON.stringify(filtered));
  writeFileSync(outputPath, "");
  writeFileSync(
    pnpmPath,
    [
      "#!/bin/sh",
      'case "$*" in',
      '  *--audit-level=info*) cat "$FULL_AUDIT"; exit 1 ;;',
      '  *--audit-level=high*) cat "$FILTERED_AUDIT"; exit 0 ;;',
      '  *) echo "Unexpected pnpm arguments" >&2; exit 2 ;;',
      "esac",
      "",
    ].join("\n"),
    { mode: 0o755 }
  );

  const workflow = readFileSync(
    new URL("../workflows/audit.yml", import.meta.url),
    "utf8"
  );
  const section = workflow
    .split("      - name: Collect pnpm audit results\n")[1]
    ?.split("\n      - name:")[0];
  assert.ok(section, "The audit collection step must exist.");
  const block = section.match(/^        run: \|\n((?: {10}.+(?:\n|$))+)/m)?.[1];
  assert.ok(block, "The audit collection step must contain a shell script.");
  const script = block
    .split("\n")
    .map((line) => line.slice(10))
    .join("\n");
  const env = {
    ...process.env,
    PATH: `${directory}${delimiter}${process.env.PATH}`,
    FULL_AUDIT: fullPath,
    FILTERED_AUDIT: filteredPath,
    AUDIT_JSON_PATH: jsonPath,
    AUDIT_STDERR_PATH: stderrPath,
    AUDIT_LEVEL: "high",
    GITHUB_OUTPUT: outputPath,
  };
  const collection = spawnSync("bash", ["-e", "-o", "pipefail", "-c", script], {
    env,
    encoding: "utf8",
  });
  assert.equal(collection.status, 0, collection.stderr);
  const exitCode = readFileSync(outputPath, "utf8").match(/^exit_code=(\d+)$/m);
  assert.ok(exitCode, "The audit exit code must be recorded.");

  const summary = spawnSync(
    process.execPath,
    [join(import.meta.dirname, "audit-summary.mjs")],
    {
      env: {
        ...env,
        AUDIT_EXIT_CODE: exitCode[1],
        AUDIT_NAME: "docs-site",
        AUDIT_DIRECTORY: "docs-site",
      },
      encoding: "utf8",
    }
  );
  assert.equal(summary.status, 0, summary.stderr);
  assert.match(summary.stdout, /\| Non-blocking \| moderate \| minimatch \|/);
  assert.doesNotMatch(summary.stdout, /No advisories found/);
});

test("reports command failures without findings as an audit error", () => {
  const result = render({}, "moderate", 1);

  assert.equal(result.exitCode, 1);
  assert.match(result.markdown, /Audit could not be confirmed/);
  assert.match(result.markdown, /exited with code 1/);
});

test("reports advisories when pnpm unexpectedly exits successfully", () => {
  const result = render({ 1: advisory("high") }, "high", 0);

  assert.equal(result.exitCode, 1);
  assert.match(result.markdown, /passed despite reporting advisories/);
});

test("reports unexpected audit exit codes as errors even with advisories", () => {
  const result = render({ 1: advisory("high") }, "high", 2);

  assert.equal(result.exitCode, 1);
  assert.match(result.markdown, /Audit could not be confirmed/);
  assert.match(result.markdown, /exited with code 2/);
});

test("rejects malformed or incomplete audit output", () => {
  assert.throws(
    () => parseAuditJson("{}"),
    /missing advisories or vulnerability metadata/
  );
  assert.throws(
    () =>
      parseAuditJson(
        JSON.stringify({ advisories: {}, metadata: { vulnerabilities: {} } })
      ),
    /incomplete vulnerability counts/
  );
});

test("reports invalid audit output and stderr as a failed audit", () => {
  const directory = mkdtempSync(join(tmpdir(), "hookify-audit-summary-"));
  const jsonPath = join(directory, "audit.json");
  const stderrPath = join(directory, "audit.stderr");
  const names = [
    "AUDIT_JSON_PATH",
    "AUDIT_STDERR_PATH",
    "AUDIT_EXIT_CODE",
    "AUDIT_NAME",
    "AUDIT_DIRECTORY",
    "AUDIT_LEVEL",
  ];
  const originalEnvironment = Object.fromEntries(
    names.map((name) => [name, process.env[name]])
  );
  writeFileSync(jsonPath, "not json");
  writeFileSync(stderrPath, "registry unavailable");

  Object.assign(process.env, {
    AUDIT_JSON_PATH: jsonPath,
    AUDIT_STDERR_PATH: stderrPath,
    AUDIT_EXIT_CODE: "1",
    AUDIT_NAME: "library",
    AUDIT_DIRECTORY: ".",
    AUDIT_LEVEL: "moderate",
  });

  try {
    const result = createAuditSummary();
    assert.equal(result.exitCode, 1);
    assert.match(result.markdown, /Audit could not be confirmed/);
    assert.match(result.markdown, /registry unavailable/);
  } finally {
    for (const name of names) {
      if (originalEnvironment[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalEnvironment[name];
      }
    }
    unlinkSync(jsonPath);
    unlinkSync(stderrPath);
    rmdirSync(directory);
  }
});
