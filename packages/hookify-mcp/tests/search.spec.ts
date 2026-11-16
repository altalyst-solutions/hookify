import { describe, expect, it } from "vitest";

import { hooksData } from "../src/data.ts";
import { searchHooks, stem, tokenize } from "../src/search.ts";

/**
 * Plain-language problems and the hook that should come first. A change to the
 * search or to a docs page's metadata that breaks one of these fails CI.
 */
const GOLDEN_QUERIES: [query: string, expected: string][] = [
  ["debounce a search input", "useDebouncedValue"],
  ["call a function at most once every 200ms", "useRateLimitedCallback"],
  ["close a dropdown when clicking outside", "useOutsideClick"],
  ["save state to localStorage", "usePersistedState"],
  ["only one browser tab should poll the server", "useTabLeader"],
  ["detect when an element scrolls into view", "useIntersectionObserver"],
  ["copy text to clipboard", "useClipboard"],
  ["previous value of a prop", "usePrevious"],
  ["run something every second", "useInterval"],
  ["show a shadow under a sticky header", "useIsStuck"],
  ["track how long an ad was visible", "useImpression"],
  ["fetch data from a REST API", "useApi"],
  ["check if the user prefers dark mode", "useMediaQuery"],
  ["resend code button with a countdown", "useCooldown"],
];

describe("searchHooks", () => {
  it.each(GOLDEN_QUERIES)("ranks %j first as %s", (query, expected) => {
    const [top] = searchHooks(query, hooksData);
    expect(top?.hook.name).toBe(expected);
    expect(top?.strength).toBe("best");
  });

  // Both hooks stop duplicate work across tabs: the lock serializes it, the
  // leader runs it in one tab. Either is a fair first answer, but both belong
  // at the top.
  it("ranks useWebLock and useTabLeader first for duplicate work across tabs", () => {
    const names = searchHooks(
      "make sure two tabs don't run the same job at once",
      hooksData
    ).map((result) => result.hook.name);
    expect(names.slice(0, 2).sort()).toEqual(["useTabLeader", "useWebLock"]);
  });

  it("returns nothing for an unrelated query", () => {
    expect(searchHooks("make me a coffee", hooksData)).toEqual([]);
  });

  it("returns nothing for a query made only of stop words", () => {
    expect(searchHooks("the a of to", hooksData)).toEqual([]);
  });

  it("labels every result a possible match when the top one is weak", () => {
    const results = searchHooks("state", hooksData);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.strength === "possible")).toBe(
      true
    );
  });

  it("ranks a replacement above its deprecated alias", () => {
    const names = searchHooks("debounce", hooksData, 5).map(
      (result) => result.hook.name
    );
    expect(names.indexOf("useDebouncedCallback")).toBeLessThan(
      names.indexOf("useDebounce")
    );
  });

  it("explains each match with the use case that fits the query", () => {
    const [top] = searchHooks("debounce a search input", hooksData);
    expect(top?.matchedUseCase).toMatch(/search/i);
  });

  it("respects the limit", () => {
    expect(searchHooks("element", hooksData, 1)).toHaveLength(1);
    expect(searchHooks("element", hooksData, 5)).toHaveLength(5);
  });
});

describe("tokenize", () => {
  it("splits camelCase names and drops stop words", () => {
    expect(tokenize("useDebouncedValue for the input")).toEqual([
      "debounc",
      "valu",
      "input",
    ]);
  });

  it("stems word forms to the same stem", () => {
    for (const forms of [
      ["debounce", "debounced", "debouncing", "debounces"],
      ["value", "values"],
      ["query", "queries"],
      ["click", "clicks", "clicked"],
    ]) {
      expect(new Set(forms.map(stem)).size).toBe(1);
    }
  });
});
