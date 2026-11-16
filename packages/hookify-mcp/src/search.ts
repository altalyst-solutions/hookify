import type { HookEntry, HooksData } from "./types.ts";

/** How much a query word counts when found in each field of a hook. */
const WEIGHTS = {
  name: 5,
  useWhen: 4,
  keywords: 3,
  description: 2,
  category: 1,
} as const;

/**
 * Extra weight when every word of a multi-word keyword is in the query, such
 * as "every second". Scaled by how distinctive the phrase's words are.
 */
const PHRASE_WEIGHT = 4;

/** Synonyms count for this share of the field weight they match. */
const SYNONYM_WEIGHT = 0.5;

/** Deprecated hooks keep this share of their score, so replacements rank first. */
const DEPRECATED_FACTOR = 0.3;

/**
 * The top result is a "best match" only when it scores at least this much.
 * Roughly a distinctive word in a hook's name plus one in its use cases.
 */
const BEST_MATCH_SCORE = 25;

/** Other results are a "good match" when they reach this share of the top score. */
const GOOD_MATCH_SHARE = 0.6;

/** Words too common to tell hooks apart. */
const STOP_WORDS = new Set(
  "a an and are as at be but by can do does for from get how i if in into is it its me my of on one only or so some that the their them then there this to too use used using want we what when where which while who why will with without you your hook hooks react".split(
    " "
  )
);

/**
 * Words people use for a problem, mapped to words the hook data uses. They
 * widen the search at {@link SYNONYM_WEIGHT}.
 */
const SYNONYMS: Record<string, string[]> = {
  typing: ["debounce", "input"],
  type: ["debounce", "input"],
  keystroke: ["debounce"],
  stop: ["debounce"],
  wait: ["debounce", "delay", "timeout"],
  pause: ["debounce", "visibility"],
  later: ["timeout", "delay"],
  after: ["timeout", "delay"],
  once: ["timeout"],
  every: ["interval"],
  repeat: ["interval"],
  periodically: ["interval"],
  second: ["interval", "now", "time"],
  timer: ["interval", "timeout"],
  most: ["rate", "limit", "throttle"],
  quota: ["rate", "limit"],
  visible: ["visibility", "intersection", "view"],
  view: ["visibility", "intersection"],
  seen: ["impression", "visibility"],
  scroll: ["intersection", "sticky", "view"],
  viewport: ["intersection", "visibility"],
  tab: ["visibility", "leader", "tabs"],
  tabs: ["leader", "lock", "tab"],
  browser: ["tab", "tabs"],
  same: ["leader", "lock"],
  job: ["lock", "leader"],
  storage: ["persist", "localstorage"],
  save: ["persist", "localstorage"],
  remember: ["persist", "localstorage"],
  reload: ["persist", "localstorage"],
  click: ["outside", "dismiss"],
  close: ["outside", "dismiss"],
  dropdown: ["outside", "dismiss"],
  fetch: ["api", "http", "request"],
  request: ["api", "http", "fetch"],
  api: ["fetch", "http", "request"],
  copy: ["clipboard"],
  paste: ["clipboard"],
  size: ["width", "height", "resize"],
  width: ["size", "resize"],
  screen: ["media", "breakpoint"],
  mobile: ["media", "breakpoint"],
  dark: ["media", "prefers-color-scheme"],
  last: ["previous"],
  old: ["previous"],
  prop: ["previous", "value"],
  toggle: ["boolean"],
  flag: ["boolean", "toggle"],
  open: ["toggle", "boolean"],
  callback: ["stable", "function"],
  rerender: ["stable", "memo"],
  clock: ["now", "interval", "time"],
  time: ["now", "clock"],
  ago: ["now", "relative"],
};

/**
 * Reduces a word to a rough stem so `debouncing`, `debounced` and `debounces`
 * match `debounce`.
 *
 * @param word - A lowercase word.
 * @returns Its stem.
 */
export const stem = (word: string) => {
  let result = word;
  if (result.length > 5 && result.endsWith("ing")) result = result.slice(0, -3);
  else if (result.length > 4 && result.endsWith("ies")) {
    result = `${result.slice(0, -3)}y`;
  } else if (result.length > 4 && result.endsWith("ed")) {
    result = result.slice(0, -2);
  } else if (result.length > 4 && /(sh|ch|x|ss)es$/.test(result)) {
    result = result.slice(0, -2);
  } else if (
    result.length > 3 &&
    result.endsWith("s") &&
    !result.endsWith("ss")
  ) {
    result = result.slice(0, -1);
  }
  // Then treat the silent-e form as the same word, so `value` and `values`,
  // or `debounce` and `debounced`, end up equal.
  if (result.length > 4 && result.endsWith("e")) result = result.slice(0, -1);
  return result;
};

/**
 * Splits text into searchable words.
 *
 * @param text - Any text, including camelCase names such as `useDebouncedValue`.
 * @returns Lowercase stems, without stop words, in order.
 */
export const tokenize = (text: string) =>
  text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map(stem);

/**
 * {@link SYNONYMS} keyed and valued by stems, so lookups work on tokenized
 * query words (`typing` and `types` both become `typ`).
 */
const SYNONYM_STEMS = new Map<string, string[]>();
for (const [word, synonyms] of Object.entries(SYNONYMS)) {
  const key = stem(word);
  const values = synonyms.flatMap(tokenize);
  SYNONYM_STEMS.set(key, [...(SYNONYM_STEMS.get(key) ?? []), ...values]);
}

/** The searchable words of one hook, by field. */
interface HookIndex {
  /** The hook. */
  hook: HookEntry;
  /** Words in each field. */
  fields: Record<keyof typeof WEIGHTS, Set<string>>;
  /** Multi-word keywords, as their words. */
  phrases: string[][];
  /** The words of each use case, to pick the one that best fits a query. */
  useCases: Set<string>[];
}

/** An index of every hook, plus how distinctive each word is. */
interface SearchIndex {
  /** One entry per hook. */
  entries: HookIndex[];
  /**
   * Inverse document frequency per word: `log(1 + hooks / hooksWithWord)`. A
   * word found in few hooks (`clipboard`) tells them apart far better than one
   * found in many (`callback`), so matches are scaled by it.
   */
  idf: Map<string, number>;
}

/**
 * Indexes the hooks for searching.
 *
 * @param data - The hook data.
 * @returns One index entry per hook.
 */
const buildIndex = (data: HooksData): SearchIndex => {
  const entries = data.hooks.map((hook) => ({
    hook,
    fields: {
      name: new Set(tokenize(hook.name.replace(/^use/, ""))),
      useWhen: new Set(hook.useWhen.flatMap(tokenize)),
      keywords: new Set(hook.keywords.flatMap(tokenize)),
      description: new Set(tokenize(hook.description)),
      category: new Set(tokenize(hook.category)),
    },
    phrases: hook.keywords.map(tokenize).filter((words) => words.length > 1),
    useCases: hook.useWhen.map((useCase) => new Set(tokenize(useCase))),
  }));

  /** How many hooks mention each word in any field. */
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const words = new Set(
      Object.values(entry.fields).flatMap((field) => [...field])
    );
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const idf = new Map(
    [...counts].map(([word, count]) => [
      word,
      Math.log(1 + entries.length / count),
    ])
  );
  return { entries, idf };
};

/** How a result ranks against the others. */
export type MatchStrength = "best" | "good" | "possible";

/** One `find_hook` result. */
export interface SearchResult {
  /** The matching hook. */
  hook: HookEntry;
  /** Its relevance score; only meaningful compared with other results. */
  score: number;
  /** How strong the match is. */
  strength: MatchStrength;
  /** The use case from the hook's docs that best fits the query, if any. */
  matchedUseCase?: string;
}

/** Cached index for the data passed to {@link searchHooks}. */
const indexCache = new WeakMap<HooksData, SearchIndex>();

/**
 * Finds the hooks that best fit a plain-language description of a problem.
 *
 * @param query - What the user wants to do, such as "debounce a search input".
 * @param data - The hook data to search.
 * @param limit - The most results to return. Default is `3`.
 * @returns The matching hooks, best first; empty when nothing matches.
 */
export const searchHooks = (
  query: string,
  data: HooksData,
  limit = 3
): SearchResult[] => {
  let index = indexCache.get(data);
  if (!index) {
    index = buildIndex(data);
    indexCache.set(data, index);
  }

  const queryWords = [...new Set(tokenize(query))];
  const synonymWords = [
    ...new Set(
      queryWords
        .flatMap((word) => SYNONYM_STEMS.get(word) ?? [])
        .filter((word) => !queryWords.includes(word))
    ),
  ];
  const queryWordSet = new Set(queryWords);

  const { entries, idf } = index;
  const scored = entries
    .map((entry) => {
      let score = 0;
      const scoreWords = (words: string[], factor: number) => {
        for (const word of words) {
          for (const [field, weight] of Object.entries(WEIGHTS)) {
            if (entry.fields[field as keyof typeof WEIGHTS].has(word)) {
              score += weight * factor * (idf.get(word) ?? 0);
            }
          }
        }
      };
      scoreWords(queryWords, 1);
      scoreWords(synonymWords, SYNONYM_WEIGHT);
      for (const phrase of entry.phrases) {
        if (phrase.every((word) => queryWordSet.has(word))) {
          score +=
            PHRASE_WEIGHT *
            phrase.reduce((sum, word) => sum + (idf.get(word) ?? 0), 0);
        }
      }
      if (entry.hook.deprecated) score *= DEPRECATED_FACTOR;

      // The use case sharing the most words with the query explains the match.
      let matchedUseCase: string | undefined;
      let bestOverlap = 0;
      entry.useCases.forEach((words, position) => {
        const overlap = queryWords.filter((word) => words.has(word)).length;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          matchedUseCase = entry.hook.useWhen[position];
        }
      });

      return { hook: entry.hook, score, matchedUseCase };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.hook.name.localeCompare(b.hook.name))
    .slice(0, limit);

  // Runners-up are only "good" next to a confident top result; when even the
  // top result is weak, everything is a "possible" match.
  const top = scored[0]?.score ?? 0;
  const confident = top >= BEST_MATCH_SCORE;
  return scored.map((result, position) => {
    let strength: MatchStrength = "possible";
    if (confident && position === 0) strength = "best";
    else if (confident && result.score >= top * GOOD_MATCH_SHARE) {
      strength = "good";
    }
    return { ...result, strength };
  });
};
