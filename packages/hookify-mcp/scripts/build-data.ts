/**
 * @file Generates `src/generated/hooks.json`, the data the MCP server answers
 * from.
 *
 * It combines two sources, so the data always matches the library it is built
 * with:
 *
 * - the library's bundled type definitions (`@altalyst/hookify`'s
 *   `dist/index.d.ts`), for each hook's signature, TSDoc, examples and the
 *   option and return types it uses. These are exactly the types users
 *   install;
 * - the docs pages (`docs-site/docs/hooks/use-x.mdx`), for the description,
 *   keywords, category, related hooks, browser APIs and "When to use it" use
 *   cases.
 *
 * Run it with `pnpm build:data` after building the library. It fails when a
 * hook has no docs page, a page has no hook, or the library hasn't been built.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

import ts from "typescript";
import { parse } from "yaml";

import type {
  DocumentedName,
  HookCategory,
  HookEntry,
  HooksData,
  TypeEntry,
  TypeMember,
} from "../src/types.ts";

/** Directory holding one `.mdx` page per hook. */
const PAGES_DIR = resolve(import.meta.dirname, "../../../docs-site/docs/hooks");

/** Where the generated data is written; `tsc` copies it into `dist`. */
const OUTPUT = resolve(import.meta.dirname, "../src/generated/hooks.json");

/** Base URL of the hook pages on the docs site. */
const DOCS_BASE_URL = "https://altalyst-solutions.github.io/hookify/hooks/";

/** The closing line every hook's TSDoc ends with; the data has `docsUrl` instead. */
const LIVE_EXAMPLE_LINE =
  /\n*For a live, editable example, see the \[[^\]]+\]\([^)]+\)\.\s*$/;

/** A parsed docs page. */
interface DocsPage {
  /** Its front matter. */
  data: Record<string, unknown>;
  /** The page without its front matter. */
  body: string;
}

/**
 * Turns a hook name into its docs page slug.
 *
 * @param name - The hook name, such as `useDebouncedValue`.
 * @returns The slug, such as `use-debounced-value`.
 */
const toSlug = (name: string) =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * Replaces TSDoc inline links with their text.
 *
 * @param text - TSDoc text, possibly containing `{@link Target | label}`.
 * @returns The text with each link replaced by its label, or its target.
 */
const stripLinks = (text: string) =>
  text.replace(
    /\{@link(?:code|plain)?\s+([^}|]+?)(?:\s*\|\s*([^}]+?))?\s*\}/g,
    (_, target: string, label?: string) => label ?? target
  );

/**
 * Reads the text of a JSDoc comment or tag comment.
 *
 * @param comment - The comment, as the TypeScript compiler API exposes it.
 * @returns Its text with inline links resolved, trimmed.
 */
const commentText = (
  comment: string | ts.NodeArray<ts.JSDocComment> | undefined
) => stripLinks(ts.getTextOfJSDocComment(comment) ?? "").trim();

/**
 * Finds the JSDoc block attached to a declaration.
 *
 * @param node - A declaration in the bundled type definitions.
 * @returns Its closest JSDoc block, if any.
 */
const jsDocOf = (node: ts.Node): ts.JSDoc | undefined =>
  ts
    .getJSDocCommentsAndTags(node)
    .filter((entry): entry is ts.JSDoc => ts.isJSDoc(entry))
    .at(-1);

/**
 * Returns the first paragraph of some text.
 *
 * @param text - Multi-paragraph text.
 * @returns Everything before the first blank line, on one line.
 */
const firstParagraph = (text: string) =>
  text
    .split(/\n\s*\n/)[0]
    .replace(/\s*\n\s*/g, " ")
    .trim();

/**
 * Splits a TSDoc `name - description` tag comment.
 *
 * @param text - The tag text, such as `T - The type of the value.`.
 * @returns The name and the description.
 */
const splitNamed = (text: string): DocumentedName => {
  const match = /^(\S+)\s+-\s+([\s\S]*)$/.exec(text.trim());
  return match
    ? { name: match[1], description: match[2].trim() }
    : { name: text.trim(), description: "" };
};

/**
 * Reads the code of every `@example` block in a JSDoc comment.
 *
 * The examples are read from the raw comment rather than from the TypeScript
 * compiler's parsed tags: the compiler starts a new tag at any `@` after
 * whitespace, even inside a code fence, so an example containing
 * `npm i @altalyst/hookify` would be cut short.
 *
 * @param doc - The JSDoc block.
 * @param source - The parsed `index.d.ts`.
 * @returns The code of the first fence after each `@example`, in order.
 */
const readExamples = (doc: ts.JSDoc | undefined, source: ts.SourceFile) => {
  if (!doc) return [];
  const text = doc
    .getText(source)
    .replace(/^\/\*\*|\*\/$/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, ""))
    .join("\n");
  return [
    ...text.matchAll(/@example[^\n]*\n\s*```[a-z]*\n([\s\S]*?)\n```/g),
  ].map((match) => match[1].trim());
};

/**
 * Collects the exported declarations of the bundled type definitions.
 *
 * @param source - The parsed `index.d.ts`.
 * @returns Hooks (exported `use*` constants) and every exported interface and
 *   type alias, by name.
 */
const collectDeclarations = (source: ts.SourceFile) => {
  const hooks = new Map<string, ts.VariableDeclaration>();
  const types = new Map<
    string,
    ts.InterfaceDeclaration | ts.TypeAliasDeclaration
  >();

  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const name = declaration.name.getText(source);
        if (/^use[A-Z]/.test(name)) hooks.set(name, declaration);
      }
    } else if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)
    ) {
      types.set(statement.name.text, statement);
    }
  }

  return { hooks, types };
};

/** A call signature: a function type, or one overload of a callable interface. */
type Callable = ts.FunctionTypeNode | ts.CallSignatureDeclaration;

/**
 * Finds the call signatures of a hook.
 *
 * Most hooks are declared as `const useX: <T>(...) => R`. Hooks with overloads
 * are declared as `const useX: UseX`, where the `UseX` interface lists one call
 * signature per overload.
 *
 * @param declaration - The hook's `declare const` declaration.
 * @param types - Every exported interface and type alias, by name.
 * @returns Its call signatures, and the overloads interface if there is one.
 *   Empty when the type is something else, such as `typeof useLayoutEffect`.
 */
const callablesOf = (
  declaration: ts.VariableDeclaration,
  types: Map<string, ts.InterfaceDeclaration | ts.TypeAliasDeclaration>
): { callables: Callable[]; overloads?: string } => {
  const type = declaration.type;
  if (type && ts.isFunctionTypeNode(type)) return { callables: [type] };
  if (type && ts.isTypeReferenceNode(type)) {
    const name = type.typeName.getText();
    const target = types.get(name);
    if (
      target &&
      ts.isInterfaceDeclaration(target) &&
      target.members.length > 0 &&
      target.members.every(ts.isCallSignatureDeclaration)
    ) {
      return {
        callables: [...target.members] as ts.CallSignatureDeclaration[],
        overloads: name,
      };
    }
  }
  return { callables: [] };
};

/**
 * Renders a hook's call signatures, one per line for overloads.
 *
 * @param name - The hook name.
 * @param declaration - Its `declare const` declaration.
 * @param callables - Its call signatures, from {@link callablesOf}.
 * @param source - The parsed `index.d.ts`.
 * @returns For example `useDebouncedValue<T>(value: T, delay: number): T`.
 */
const renderSignature = (
  name: string,
  declaration: ts.VariableDeclaration,
  callables: Callable[],
  source: ts.SourceFile
) => {
  if (callables.length === 0) {
    const typeText = declaration.type?.getText(source) ?? "unknown";
    const reactHook = /^typeof (use[A-Z]\w*)$/.exec(typeText);
    return reactHook
      ? `${name}: ${typeText} (same signature as React's ${reactHook[1]})`
      : `${name}: ${typeText}`;
  }
  return callables
    .map((callable) => {
      const typeParams = callable.typeParameters?.length
        ? `<${callable.typeParameters.map((param) => param.getText(source)).join(", ")}>`
        : "";
      const params = callable.parameters
        .map((param) => param.getText(source).replace(/\s+/g, " "))
        .join(", ");
      const returns = callable.type?.getText(source) ?? "void";
      return `${name}${typeParams}(${params}): ${returns}`;
    })
    .join("\n");
};

/**
 * Finds the exported types a node refers to.
 *
 * @param node - A type node, such as a hook's function type.
 * @param types - Every exported interface and type alias, by name.
 * @returns The names of the exported types it references, in order.
 */
const referencedTypes = (
  node: ts.Node,
  types: Map<string, ts.Node>
): string[] => {
  const found = new Set<string>();
  const visit = (child: ts.Node) => {
    if (ts.isTypeReferenceNode(child)) {
      const name = child.typeName.getText();
      if (types.has(name)) found.add(name);
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return [...found];
};

/**
 * Describes an exported interface or type alias.
 *
 * @param declaration - The interface or type alias.
 * @param source - The parsed `index.d.ts`.
 * @returns Its summary and either its members or its definition.
 */
const describeType = (
  declaration: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
  source: ts.SourceFile
): TypeEntry => {
  const description = firstParagraph(
    commentText(jsDocOf(declaration)?.comment)
  );
  if (ts.isTypeAliasDeclaration(declaration)) {
    return {
      name: declaration.name.text,
      kind: "type",
      description,
      definition: declaration.type.getText(source).replace(/\s+/g, " "),
    };
  }
  const members: TypeMember[] = declaration.members.map((member) => {
    // Call signatures, such as a debounced function being callable, have no
    // name; show them as `(call)` with their signature as the type.
    const name = member.name?.getText(source) ?? "(call)";
    let type: string;
    if (ts.isPropertySignature(member) && member.type) {
      type = member.type.getText(source);
    } else if (
      ts.isMethodSignature(member) ||
      ts.isCallSignatureDeclaration(member)
    ) {
      const params = member.parameters
        .map((param) => param.getText(source))
        .join(", ");
      const typeParams = member.typeParameters?.length
        ? `<${member.typeParameters.map((param) => param.getText(source)).join(", ")}>`
        : "";
      type = `${typeParams}(${params}) => ${member.type?.getText(source) ?? "void"}`;
    } else {
      type = member.getText(source).replace(/;$/, "");
    }
    return {
      name,
      type: type.replace(/\s+/g, " "),
      optional: Boolean(member.questionToken),
      description: commentText(jsDocOf(member)?.comment).replace(
        /\s*\n\s*/g,
        " "
      ),
    };
  });
  return {
    name: declaration.name.text,
    kind: "interface",
    description,
    members,
  };
};

/**
 * Reads a docs page.
 *
 * @param slug - The page slug, such as `use-api`.
 * @returns Its front matter and body.
 */
const readPage = (slug: string): DocsPage => {
  const source = readFileSync(resolve(PAGES_DIR, `${slug}.mdx`), "utf8");
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!match) throw new Error(`${slug}.mdx has no front matter`);
  return { data: parse(match[1]) ?? {}, body: source.slice(match[0].length) };
};

/**
 * Reads the "When to use it" bullets of a page as plain text.
 *
 * @param body - The page without its front matter.
 * @returns One entry per top-level bullet, with Markdown links and emphasis
 *   removed. Empty for pages without the section, such as deprecated hooks.
 */
const readUseCases = (body: string) => {
  const section = /^## When to use it\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(
    body
  );
  if (!section) return [];
  const bullets: string[] = [];
  for (const line of section[1].split("\n")) {
    if (line.startsWith("- ")) bullets.push(line.slice(2));
    else if (/^\s+\S/.test(line) && bullets.length > 0) {
      bullets[bullets.length - 1] += ` ${line.trim()}`;
    }
  }
  return bullets.map((bullet) =>
    bullet
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .trim()
  );
};

/**
 * Builds the entry for one hook.
 *
 * @param name - The hook name.
 * @param declaration - Its `declare const` declaration.
 * @param types - Every exported interface and type alias, by name.
 * @param source - The parsed `index.d.ts`.
 * @returns Everything the server knows about the hook.
 */
const buildEntry = (
  name: string,
  declaration: ts.VariableDeclaration,
  types: Map<string, ts.InterfaceDeclaration | ts.TypeAliasDeclaration>,
  source: ts.SourceFile
): HookEntry => {
  const slug = toSlug(name);
  const { data, body } = readPage(slug);
  const doc = jsDocOf(declaration);
  const tags: readonly ts.JSDocTag[] = doc?.tags ?? [];
  const tagText = (tag: ts.JSDocTag) => commentText(tag.comment);
  const tagsNamed = (tagName: string) =>
    tags.filter((tag) => tag.tagName.text === tagName);

  const params = tags
    .filter((tag): tag is ts.JSDocParameterTag => ts.isJSDocParameterTag(tag))
    .map((tag) => ({
      name: tag.name.getText(source),
      description: tagText(tag).replace(/^-\s*/, ""),
    }));

  const { callables, overloads } = callablesOf(declaration, types);
  const deprecatedTag = tagsNamed("deprecated")[0];
  const entry: HookEntry = {
    name,
    slug,
    description: String(data.description),
    category: data.category as HookCategory,
    keywords: (data.keywords as string[]) ?? [],
    related: (data.related as string[] | undefined) ?? [],
    browserApis: (data.browserApis as string[]) ?? [],
    useWhen: readUseCases(body),
    signature: renderSignature(name, declaration, callables, source),
    details: commentText(doc?.comment).replace(LIVE_EXAMPLE_LINE, "").trim(),
    typeParams: tagsNamed("typeParam").map((tag) => splitNamed(tagText(tag))),
    params,
    returns: tagsNamed("returns").map(tagText).join(" "),
    examples: readExamples(doc, source),
    types: [
      ...new Set(
        callables.flatMap((callable) => referencedTypes(callable, types))
      ),
    ]
      .filter((typeName) => typeName !== overloads)
      .map((typeName) => describeType(types.get(typeName)!, source)),
    docsUrl: `${DOCS_BASE_URL}${slug}`,
  };

  if (data.deprecated === true) {
    entry.deprecated = {
      replacedBy: String(data.replacedBy),
      note: deprecatedTag
        ? tagText(deprecatedTag).replace(/\s*\n\s*/g, " ")
        : "",
    };
  }

  return entry;
};

/** Generates the data file. */
const main = () => {
  const require = createRequire(import.meta.url);
  const packageJsonPath = require.resolve("@altalyst/hookify/package.json");
  const { version } = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version: string;
  };
  const typesPath = resolve(dirname(packageJsonPath), "dist/index.d.ts");
  if (!existsSync(typesPath)) {
    throw new Error(
      `${typesPath} is missing. Build the library first: pnpm -F @altalyst/hookify build`
    );
  }

  // The bundled definitions use CRLF line endings; normalize them so TSDoc
  // text, fences and examples split cleanly.
  const source = ts.createSourceFile(
    typesPath,
    readFileSync(typesPath, "utf8").replace(/\r\n/g, "\n"),
    ts.ScriptTarget.Latest,
    true
  );
  const { hooks, types } = collectDeclarations(source);

  const pageSlugs = new Set(
    ts.sys
      .readDirectory(PAGES_DIR, [".mdx"])
      .map((path) => path.slice(PAGES_DIR.length + 1, -".mdx".length))
  );
  const problems: string[] = [];
  for (const name of hooks.keys()) {
    if (!pageSlugs.has(toSlug(name))) problems.push(`${name} has no docs page`);
  }
  const hookSlugs = new Set([...hooks.keys()].map(toSlug));
  for (const slug of pageSlugs) {
    if (!hookSlugs.has(slug)) problems.push(`${slug}.mdx has no exported hook`);
  }
  if (problems.length > 0) {
    throw new Error(
      `Hooks and docs pages don't match:\n- ${problems.join("\n- ")}`
    );
  }

  const data: HooksData = {
    hookifyVersion: version,
    hooks: [...hooks.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, declaration]) =>
        buildEntry(name, declaration, types, source)
      ),
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(data)}\n`);
  const size = Buffer.byteLength(JSON.stringify(data)) / 1024;
  console.log(
    `Wrote ${data.hooks.length} hooks for @altalyst/hookify ${version} (${size.toFixed(0)} KB) to src/generated/hooks.json`
  );
};

main();
