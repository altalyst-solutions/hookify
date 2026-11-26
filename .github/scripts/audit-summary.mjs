/**
 * @file Formats pnpm audit JSON as a GitHub Actions job summary.
 *
 * The workflow captures all pnpm advisories and its exit code so this script
 * can write a summary before enforcing the configured failure threshold.
 */
import { readFileSync } from "node:fs";

/** Severity rank used to compare findings with the configured audit threshold. */
const SEVERITY_RANK = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

/** @typedef {keyof typeof SEVERITY_RANK} Severity */

/**
 * Safely escapes plain text for a Markdown table cell.
 *
 * @param {string} value - The untrusted cell contents.
 * @returns {string} The escaped text.
 */
const escapeCell = (value) =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/**
 * Wraps an untrusted value in a Markdown code span.
 *
 * @param {string} value - The untrusted code span contents.
 * @returns {string} The escaped code span.
 */
const codeSpan = (value) => `\`${value.replaceAll("`", "&#96;")}\``;

/**
 * Explains why docs-site advisories can appear in both matrix job summaries.
 *
 * @param {string} directory - The audited directory.
 * @returns {string | undefined} A note for the overlapping audit scopes.
 */
const getScopeNote = (directory) => {
  if (directory === ".") {
    return "The workspace-root audit includes docs-site dependencies, so their findings may also appear in the docs-site summary.";
  }
  if (directory === "docs-site") {
    return "The workspace-root audit also includes docs-site dependencies, so these findings may also appear in the library summary.";
  }
  return undefined;
};

/**
 * Parses and validates the pnpm audit JSON shape used by this workflow.
 *
 * @param {string} json - The raw JSON from `pnpm audit --json`.
 * @returns {{ advisories: Array<Record<string, unknown>> }} The audit advisories.
 */
export const parseAuditJson = (json) => {
  const parsed = JSON.parse(json);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof parsed.advisories !== "object" ||
    parsed.advisories === null ||
    typeof parsed.metadata !== "object" ||
    parsed.metadata === null ||
    typeof parsed.metadata.vulnerabilities !== "object" ||
    parsed.metadata.vulnerabilities === null
  ) {
    throw new Error(
      "The audit output is missing advisories or vulnerability metadata."
    );
  }

  for (const severity of Object.keys(SEVERITY_RANK)) {
    const count = parsed.metadata.vulnerabilities[severity];
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(
        "The audit output contains incomplete vulnerability counts."
      );
    }
  }

  const advisories = Object.values(parsed.advisories);
  for (const advisory of advisories) {
    if (
      typeof advisory !== "object" ||
      advisory === null ||
      typeof advisory.severity !== "string" ||
      !Object.hasOwn(SEVERITY_RANK, advisory.severity) ||
      typeof advisory.module_name !== "string"
    ) {
      throw new Error("The audit output contains an invalid advisory.");
    }
  }

  return { advisories };
};

/**
 * Formats the audit results and applies the configured failure threshold.
 * The info-level audit exits with code 1 for any advisory, including those
 * below the configured threshold.
 *
 * @param {{
 *   audit: { advisories: Array<Record<string, unknown>> },
 *   name: string,
 *   directory: string,
 *   threshold: Severity,
 *   exitCode: number,
 *   stderr?: string
 * }} options - The audit results and workflow metadata.
 * @returns {{ markdown: string, exitCode: number }} The report and status to use for this step.
 */
export const renderAuditSummary = ({
  audit,
  name,
  directory,
  threshold,
  exitCode,
  stderr = "",
}) => {
  const blocking = audit.advisories.filter(
    (advisory) =>
      SEVERITY_RANK[/** @type {Severity} */ (advisory.severity)] >=
      SEVERITY_RANK[threshold]
  );
  const hasBlocking = blocking.length > 0;
  const hasAdvisories = audit.advisories.length > 0;

  if (exitCode > 1 || (exitCode !== 0 && !hasAdvisories)) {
    return {
      markdown: renderFailure(
        name,
        directory,
        threshold,
        `pnpm audit exited with code ${exitCode} without a usable advisory report.${
          stderr.trim() ? ` ${stderr.trim().slice(0, 1000)}` : ""
        }`
      ),
      exitCode: 1,
    };
  }

  if (exitCode === 0 && hasAdvisories) {
    return {
      markdown: renderFailure(
        name,
        directory,
        threshold,
        "pnpm audit passed despite reporting advisories at the info level."
      ),
      exitCode: 1,
    };
  }

  const outcome =
    audit.advisories.length === 0
      ? "✅ No advisories found."
      : hasBlocking
        ? `❌ ${blocking.length} blocking finding${
            blocking.length === 1 ? "" : "s"
          } at or above the threshold.`
        : `⚠️ ${audit.advisories.length} finding${audit.advisories.length === 1 ? "" : "s"} found; none meet the threshold.`;
  const rows = [...audit.advisories]
    .sort(
      (left, right) =>
        SEVERITY_RANK[/** @type {Severity} */ (right.severity)] -
          SEVERITY_RANK[/** @type {Severity} */ (left.severity)] ||
        String(left.module_name).localeCompare(String(right.module_name))
    )
    .map((advisory) => {
      const findings = Array.isArray(advisory.findings)
        ? advisory.findings
        : [];
      const paths = [
        ...new Set(
          findings.flatMap((finding) =>
            typeof finding === "object" &&
            finding !== null &&
            Array.isArray(finding.paths)
              ? finding.paths.filter((path) => typeof path === "string")
              : []
          )
        ),
      ];
      const url =
        typeof advisory.url === "string" &&
        /^https:\/\/github\.com\/advisories\/[A-Za-z0-9-]+$/.test(advisory.url)
          ? `[Advisory](${advisory.url})`
          : "–";
      const patched =
        typeof advisory.patched_versions === "string" &&
        advisory.patched_versions.length > 0
          ? advisory.patched_versions
          : "Not listed";

      const status =
        SEVERITY_RANK[/** @type {Severity} */ (advisory.severity)] >=
        SEVERITY_RANK[threshold]
          ? "Blocking"
          : "Non-blocking";

      return `| ${status} | ${escapeCell(String(advisory.severity))} | ${escapeCell(
        String(advisory.module_name)
      )} | ${escapeCell(
        typeof advisory.vulnerable_versions === "string"
          ? advisory.vulnerable_versions
          : "Not listed"
      )} | ${escapeCell(patched)} | ${
        paths.length > 0
          ? paths.map((path) => codeSpan(path)).join("<br>")
          : "–"
      } | ${url} |`;
    });

  const lines = [
    `## Dependency audit: ${escapeCell(name)}`,
    "",
    `- **Scope:** ${escapeCell(directory === "." ? "workspace root" : name)} (\`${escapeCell(directory)}\`)`,
    `- **Failure threshold:** ${escapeCell(threshold)} and above`,
    `- **Outcome:** ${outcome}`,
  ];
  const scopeNote = getScopeNote(directory);
  if (scopeNote) {
    lines.push(`- **Scope note:** ${scopeNote}`);
  }

  if (audit.advisories.length > 0) {
    lines.push(
      "",
      "| Status | Severity | Package | Affected versions | Patched versions | Dependency paths | Advisory |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      ...rows
    );
  }

  return { markdown: lines.join("\n"), exitCode: hasBlocking ? 1 : 0 };
};

/**
 * Renders a summary for an audit that could not be trusted or completed.
 *
 * @param {string} name - The matrix job name.
 * @param {string} directory - The audited directory.
 * @param {string} threshold - The configured failure threshold or its invalid value.
 * @param {string} reason - Why the audit could not be reported.
 * @returns {string} The failure report.
 */
const renderFailure = (name, directory, threshold, reason) => {
  const lines = [
    `## Dependency audit: ${escapeCell(name)}`,
    "",
    `- **Scope:** ${escapeCell(directory === "." ? "workspace root" : name)} (\`${escapeCell(directory)}\`)`,
    `- **Failure threshold:** ${escapeCell(threshold)} and above`,
    "- **Outcome:** ❌ Audit could not be confirmed.",
    `- **Reason:** ${codeSpan(reason)}`,
  ];
  const scopeNote = getScopeNote(directory);
  if (scopeNote) {
    lines.splice(4, 0, `- **Scope note:** ${scopeNote}`);
  }
  return lines.join("\n");
};

/**
 * Builds a report from workflow environment variables and writes it to stdout.
 *
 * @returns {{ markdown: string, exitCode: number }} The report and process exit code.
 */
export const createAuditSummary = () => {
  const {
    AUDIT_JSON_PATH,
    AUDIT_STDERR_PATH,
    AUDIT_EXIT_CODE,
    AUDIT_NAME,
    AUDIT_DIRECTORY,
    AUDIT_LEVEL,
  } = process.env;
  const name = AUDIT_NAME || "unknown";
  const directory = AUDIT_DIRECTORY || "unknown";
  const threshold = AUDIT_LEVEL || "not configured";
  const parsedExitCode =
    AUDIT_EXIT_CODE && /^\d+$/.test(AUDIT_EXIT_CODE)
      ? Number(AUDIT_EXIT_CODE)
      : undefined;

  try {
    if (!AUDIT_NAME || !AUDIT_DIRECTORY) {
      throw new Error("The audit scope metadata was not provided.");
    }
    if (!AUDIT_LEVEL || !Object.hasOwn(SEVERITY_RANK, AUDIT_LEVEL)) {
      throw new Error("The audit severity threshold is invalid or missing.");
    }
    if (!AUDIT_JSON_PATH) {
      throw new Error("The audit output file path was not provided.");
    }
    if (parsedExitCode === undefined) {
      throw new Error("The audit command did not produce a valid exit code.");
    }

    const audit = parseAuditJson(readFileSync(AUDIT_JSON_PATH, "utf8"));
    const stderr = AUDIT_STDERR_PATH
      ? readFileSync(AUDIT_STDERR_PATH, "utf8")
      : "";
    const result = renderAuditSummary({
      audit,
      name,
      directory,
      threshold: /** @type {Severity} */ (AUDIT_LEVEL),
      exitCode: parsedExitCode,
      stderr,
    });

    return result;
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unknown audit summary error.";
    let stderr = "";
    if (AUDIT_STDERR_PATH) {
      try {
        stderr = readFileSync(AUDIT_STDERR_PATH, "utf8").trim();
      } catch {
        // The audit may have failed before it could create its stderr file.
      }
    }
    const reason = stderr ? `${details} ${stderr.slice(0, 1000)}` : details;
    return {
      markdown: renderFailure(name, directory, threshold, reason),
      exitCode: 1,
    };
  }
};

if (import.meta.main) {
  const result = createAuditSummary();
  console.log(result.markdown);
  process.exitCode = result.exitCode;
}
