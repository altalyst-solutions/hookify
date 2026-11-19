import type { SearchResult } from "./search.ts";
import type { HookCategory, HookEntry, HooksData, TypeEntry } from "./types.ts";

/** Category headings for `list_hooks`, in display order. */
export const CATEGORY_TITLES: Record<HookCategory, string> = {
  state: "State",
  timing: "Timing (debounce, throttle, timers)",
  async: "Async and data fetching",
  dom: "DOM, events and visibility",
  browser: "Browser features",
  lifecycle: "Lifecycle and effects",
  refs: "Refs and stable callbacks",
};

/**
 * Prefixes a response with an optional note, such as a version mismatch.
 *
 * @param text - The response.
 * @param note - A note to show first, if any.
 * @returns The response, with the note and a blank line before it when given.
 */
export const withNote = (text: string, note?: string) =>
  note ? `${note}\n\n${text}` : text;

/** Options for {@link formatHookList}. */
export interface HookListOptions {
  /** Only list this category. Default is every category. */
  category?: HookCategory;
  /** Also list deprecated hooks. Default is `false`. */
  includeDeprecated?: boolean;
}

/** Options for {@link formatHook}. */
interface FormatHookOptions {
  /** Include every documented example. Default is `false`. */
  includeAllExamples?: boolean;
}

/**
 * Formats the `list_hooks` response: one line per hook, grouped by category.
 *
 * @param data - The hook data.
 * @param options - Which hooks to include.
 * @returns The list as Markdown.
 */
export const formatHookList = (
  data: HooksData,
  options: HookListOptions = {}
) => {
  const { category, includeDeprecated = false } = options;
  const hooks = data.hooks.filter(
    (hook) =>
      (includeDeprecated || !hook.deprecated) &&
      (!category || hook.category === category)
  );
  const hiddenDeprecated = includeDeprecated
    ? 0
    : data.hooks.filter(
        (hook) => hook.deprecated && (!category || hook.category === category)
      ).length;

  const lines = [
    `@altalyst/hookify ${data.hookifyVersion}: ${hooks.length} hook${hooks.length === 1 ? "" : "s"}${category ? ` in "${category}"` : ""}.${hiddenDeprecated > 0 ? ` ${hiddenDeprecated} deprecated hook${hiddenDeprecated === 1 ? " is" : "s are"} hidden; pass includeDeprecated: true to list ${hiddenDeprecated === 1 ? "it" : "them"}.` : ""}`,
  ];
  for (const [key, title] of Object.entries(CATEGORY_TITLES)) {
    const inCategory = hooks.filter((hook) => hook.category === key);
    if (inCategory.length === 0) continue;
    lines.push("", `## ${title} (${key})`);
    for (const hook of inCategory) {
      const replacement = hook.deprecated
        ? ` Deprecated: use ${hook.deprecated.replacedBy}.`
        : "";
      lines.push(`- ${hook.name}: ${hook.description}${replacement}`);
    }
  }
  lines.push(
    "",
    "Call get_hook with a name for its signature, options and an example."
  );
  return lines.join("\n");
};

/**
 * Formats an exported type used by a hook.
 *
 * @param type - The type.
 * @returns Its name, summary and members (or definition) as Markdown.
 */
const formatType = (type: TypeEntry) => {
  const lines = [
    `### ${type.name}${type.description ? `: ${type.description}` : ""}`,
  ];
  if (type.kind === "type") {
    lines.push("```ts", `type ${type.name} = ${type.definition};`, "```");
  } else {
    for (const member of type.members ?? []) {
      const signature =
        member.name === "(call)"
          ? `(call) ${member.type}`
          : `${member.name}${member.optional ? "?" : ""}: ${member.type}`;
      lines.push(
        `- \`${signature}\`${member.description ? `: ${member.description}` : ""}`
      );
    }
  }
  return lines.join("\n");
};

/**
 * Formats the `get_hook` response: everything needed to use one hook.
 *
 * @param hook - The hook.
 * @param data - The hook data, for the version line.
 * @param options - Whether to include every documented example.
 * @returns The hook's docs as Markdown.
 */
export const formatHook = (
  hook: HookEntry,
  data: HooksData,
  options: FormatHookOptions = {}
) => {
  const sections: string[] = [`# ${hook.name}`, hook.description];

  if (hook.deprecated) {
    sections.push(
      `**Deprecated.** Use ${hook.deprecated.replacedBy} instead. ${hook.deprecated.note}`.trim()
    );
  }

  sections.push(
    [
      `Import: \`import { ${hook.name} } from "@altalyst/hookify";\` (version ${data.hookifyVersion})`,
      `Category: ${hook.category}`,
      `Browser APIs: ${hook.browserApis.length > 0 ? `${hook.browserApis.join(", ")} (SSR-safe; see the details for what happens without them)` : "none"}`,
      `Docs: ${hook.docsUrl}`,
    ].join("\n")
  );

  sections.push(`## Signature\n\`\`\`ts\n${hook.signature}\n\`\`\``);

  if (hook.typeParams.length > 0 || hook.params.length > 0) {
    const lines = ["## Parameters"];
    for (const param of hook.typeParams) {
      lines.push(`- \`${param.name}\` (type parameter): ${param.description}`);
    }
    for (const param of hook.params) {
      lines.push(`- \`${param.name}\`: ${param.description}`);
    }
    sections.push(lines.join("\n"));
  }

  if (hook.returns) sections.push(`## Returns\n${hook.returns}`);

  if (hook.types.length > 0) {
    sections.push(["## Types", ...hook.types.map(formatType)].join("\n\n"));
  }

  if (hook.useWhen.length > 0) {
    sections.push(
      [
        "## When to use it",
        ...hook.useWhen.map((useCase) => `- ${useCase}`),
      ].join("\n")
    );
  }

  if (hook.details) sections.push(`## Details\n${hook.details}`);

  const examples = options.includeAllExamples
    ? hook.examples
    : hook.examples.slice(0, 1);
  if (examples.length > 0) {
    if (options.includeAllExamples && examples.length > 1) {
      sections.push(
        [
          "## Examples",
          ...examples.map((example, index) => {
            const language = /<[A-Za-z]/.test(example) ? "tsx" : "ts";
            return `### Example ${index + 1}\n\`\`\`${language}\n${example}\n\`\`\``;
          }),
        ].join("\n\n")
      );
    } else {
      const [example] = examples;
      const language = /<[A-Za-z]/.test(example) ? "tsx" : "ts";
      const moreExamples = hook.examples.length - examples.length;
      sections.push(
        `## Example\n\`\`\`${language}\n${example}\n\`\`\`${moreExamples > 0 ? `\n${moreExamples} more example${moreExamples === 1 ? "" : "s"} on the docs page.` : ""}`
      );
    }
  }

  if (hook.related.length > 0) {
    sections.push(`## Related\n${hook.related.join(", ")}`);
  }

  return sections.join("\n\n");
};

/**
 * Formats the `find_hook` response.
 *
 * @param query - The search query.
 * @param results - The search results, best first.
 * @param data - The hook data, for the hook count.
 * @returns The ranked matches as Markdown, or a no-match message.
 */
export const formatSearchResults = (
  query: string,
  results: SearchResult[],
  data: HooksData
) => {
  if (results.length === 0) {
    return `No hook matches "${query}". Call list_hooks to see all ${data.hooks.length} hooks in @altalyst/hookify ${data.hookifyVersion}.`;
  }
  const lines = [`Hooks for "${query}", best first:`];
  results.forEach((result, position) => {
    const { hook } = result;
    const deprecated = hook.deprecated
      ? ` Deprecated: prefer ${hook.deprecated.replacedBy}.`
      : "";
    lines.push(
      "",
      `${position + 1}. ${hook.name} (${result.strength} match): ${hook.description}${deprecated}`
    );
    if (result.matchedUseCase) lines.push(`   Fits: ${result.matchedUseCase}`);
  });
  lines.push(
    "",
    results[0].strength === "best"
      ? `Call get_hook with "${results[0].hook.name}" for its signature, options and an example.`
      : "None of these is a strong match; call list_hooks to browse every hook."
  );
  return lines.join("\n");
};
