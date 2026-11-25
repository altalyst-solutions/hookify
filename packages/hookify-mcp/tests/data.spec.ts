import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  findHook,
  hooksData,
  installedHookifyVersion,
  suggestNames,
  versionNote,
} from "../src/data.ts";

/** The library's hooks barrel file: one `export *` line per hook. */
const HOOKS_INDEX = resolve(
  import.meta.dirname,
  "../../hookify/src/hooks/index.ts"
);

/** Temporary project directories created by a test. */
const tempDirs: string[] = [];

/**
 * Creates a temporary project, optionally with hookify installed.
 *
 * @param hookifyVersion - The version to install, or `undefined` for none.
 * @returns The project directory.
 */
const makeProject = (hookifyVersion?: string) => {
  const dir = mkdtempSync(join(tmpdir(), "hookify-mcp-"));
  tempDirs.push(dir);
  writeFileSync(join(dir, "package.json"), "{}");
  if (hookifyVersion) {
    const pkg = join(dir, "node_modules/@altalyst/hookify");
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, "package.json"),
      JSON.stringify({
        name: "@altalyst/hookify",
        version: hookifyVersion,
        exports: { "./package.json": "./package.json" },
      })
    );
  }
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true });
});

describe("hooks data", () => {
  it("has one entry per hook the library exports", async () => {
    const { readFileSync } = await import("node:fs");
    const exported = [
      ...readFileSync(HOOKS_INDEX, "utf8").matchAll(
        /export \* from "\.\/(use-[a-z-]+)";/g
      ),
    ].map((match) => match[1]);
    expect(hooksData.hooks.map((hook) => hook.slug).sort()).toEqual(
      exported.sort()
    );
  });

  it("describes the library version in this workspace", async () => {
    const { readFileSync } = await import("node:fs");
    const { version } = JSON.parse(
      readFileSync(resolve(HOOKS_INDEX, "../../../package.json"), "utf8")
    ) as { version: string };
    expect(hooksData.hookifyVersion).toBe(version);
  });

  it("gives every hook a signature, docs link and description", () => {
    for (const hook of hooksData.hooks) {
      expect(hook.signature, hook.name).toMatch(
        new RegExp(`^${hook.name}[<(:]`)
      );
      expect(hook.docsUrl, hook.name).toBe(
        `https://altalyst-solutions.github.io/hookify/hooks/${hook.slug}`
      );
      expect(hook.description.length, hook.name).toBeGreaterThan(20);
    }
  });

  it("gives every current hook at least two use cases and an example", () => {
    for (const hook of hooksData.hooks.filter((entry) => !entry.deprecated)) {
      expect(hook.useWhen.length, hook.name).toBeGreaterThanOrEqual(2);
      expect(hook.examples.length, hook.name).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps examples free of code fences and the docs link line", () => {
    for (const hook of hooksData.hooks) {
      for (const example of hook.examples) {
        expect(example, hook.name).not.toMatch(/```|For a live, editable/);
      }
    }
  });

  it("keeps example code that contains an @ intact", () => {
    expect(findHook("useClipboard")?.examples[0]).toContain(
      'copy("npm i @altalyst/hookify")'
    );
  });

  it("names the test fakes a hook needs, all of which the testing entry exports", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const testingDir = resolve(HOOKS_INDEX, "../../testing");
    const exports = new Set(
      readdirSync(testingDir)
        .filter((file) => file !== "index.ts")
        .flatMap((file) => [
          ...readFileSync(resolve(testingDir, file), "utf8").matchAll(
            /^export const (\w+)/gm
          ),
        ])
        .map((match) => match[1])
    );
    expect(findHook("useClipboard")?.testing).toEqual(["installClipboard"]);
    expect(findHook("useDebounce")?.testing).toEqual([]);
    for (const hook of hooksData.hooks) {
      for (const helper of hook.testing) {
        expect(exports.has(helper), `${hook.name}: ${helper}`).toBe(true);
      }
    }
  });

  it("points deprecated hooks at an existing, current replacement", () => {
    const deprecated = hooksData.hooks.filter((hook) => hook.deprecated);
    expect(deprecated.map((hook) => hook.name).sort()).toEqual([
      "useDebounce",
      "useThrottle",
    ]);
    for (const hook of deprecated) {
      const replacement = findHook(hook.deprecated!.replacedBy);
      expect(replacement?.deprecated, hook.name).toBeUndefined();
      expect(hook.deprecated!.note, hook.name).not.toBe("");
    }
  });

  it("renders overloaded hooks as one signature per overload", () => {
    expect(findHook("usePrevious")?.signature.split("\n")).toHaveLength(2);
  });

  it("lists the option and return types a hook uses, with documented members", () => {
    const hook = findHook("useDebouncedCallback");
    expect(hook?.types.map((type) => type.name)).toEqual([
      "UseDebouncedCallbackOptions",
      "DebouncedFunction",
    ]);
    const leading = hook?.types[0].members?.find(
      (member) => member.name === "leading"
    );
    expect(leading).toMatchObject({ type: "boolean", optional: true });
    expect(leading?.description).toMatch(/Default is `false`/);
  });

  it("only writes generated files the server reads", () => {
    const generated = resolve(import.meta.dirname, "../src/generated");
    expect(readdirSync(generated)).toEqual(["hooks.json"]);
  });
});

describe("findHook", () => {
  it("finds a hook by name, case-insensitively", () => {
    expect(findHook("useDebouncedValue")?.name).toBe("useDebouncedValue");
    expect(findHook("USEDEBOUNCEDVALUE")?.name).toBe("useDebouncedValue");
  });

  it("finds a hook by its docs slug", () => {
    expect(findHook("use-debounced-value")?.name).toBe("useDebouncedValue");
  });

  it("returns undefined for an unknown name", () => {
    expect(findHook("useNothing")).toBeUndefined();
  });
});

describe("suggestNames", () => {
  it("suggests the closest names first", () => {
    expect(suggestNames("useDebouncedValu")[0]).toBe("useDebouncedValue");
    expect(suggestNames("useOutsideClik", 1)).toEqual(["useOutsideClick"]);
  });
});

describe("installedHookifyVersion", () => {
  it("reads the version installed in a project", () => {
    expect(installedHookifyVersion(makeProject("0.9.0"))).toBe("0.9.0");
  });

  it("returns undefined when the project doesn't have hookify", () => {
    expect(installedHookifyVersion(makeProject())).toBeUndefined();
  });
});

describe("versionNote", () => {
  it("warns when the installed version differs from the documented one", () => {
    expect(versionNote("0.9.0", "0.13.0")).toMatch(
      /has @altalyst\/hookify 0\.9\.0, but these docs describe 0\.13\.0/
    );
  });

  it("says nothing when the versions match or hookify isn't installed", () => {
    expect(versionNote("0.13.0", "0.13.0")).toBeUndefined();
    expect(versionNote(undefined, "0.13.0")).toBeUndefined();
  });
});
