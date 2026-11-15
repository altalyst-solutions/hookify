import { useCallback, useMemo } from "react";

import { useLatest } from "./use-latest";
import type { PersistedStateStorage } from "./use-persisted-state";
import { usePersistedState } from "./use-persisted-state";

/** Default half-life of a score, in milliseconds (7 days). */
const DEFAULT_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

/** Default for {@link UseFrecencyOptions.maxItems}. */
const DEFAULT_MAX_ITEMS = 100;

/** Returns the current time in milliseconds; reads `Date.now` on every call so fake timers apply. */
const defaultNow = () => Date.now();

/** What is stored for one item. */
interface StoredEntry {
  /** The item's score as it was at `updatedAt`. */
  score: number;
  /** When `score` was last updated, in milliseconds since the epoch. */
  updatedAt: number;
}

/** The persisted value: stored entries by item id (numbers are stored as strings). */
type StoredFrecency = Record<string, StoredEntry>;

/** The initial value of the persisted state. A constant, so it is never re-created. */
const EMPTY_STORE: StoredFrecency = {};

/** Options for {@link useFrecency}. */
export interface UseFrecencyOptions {
  /**
   * How long it takes a score to halve, in milliseconds. A shorter half-life
   * favors what was used recently, a longer one favors what was used often.
   * Zero, negative and non-finite values fall back to the default. Default is
   * 7 days.
   */
  halfLifeMs?: number;
  /**
   * The most items to keep. When {@link UseFrecencyReturn.record | record}
   * adds an item beyond this limit, the items with the lowest scores are
   * removed, never the item that was just recorded. Use `Infinity` to keep
   * everything. Values below 1 fall back to the default, and fractions are
   * rounded down. Lowering the limit takes effect on the next `record`.
   * Default is `100`.
   */
  maxItems?: number;
  /**
   * Returns the current time in milliseconds. Inject it to make scores
   * deterministic in tests, or to use a server-synchronized clock. It is read
   * every time a score is recorded or read, so passing a new function on a later
   * render is fine. Default is `Date.now`.
   */
  now?: () => number;
  /**
   * Where to persist the scores. Defaults to `localStorage`. Use
   * `sessionStorage` to forget them when the tab closes, or any object with
   * `getItem` and `setItem` (see {@link PersistedStateStorage}).
   */
  storage?: PersistedStateStorage;
}

/**
 * Value returned by {@link useFrecency}.
 *
 * @typeParam T - The type of the item ids.
 */
export interface UseFrecencyReturn<T extends string | number> {
  /**
   * Counts one use of `id` now: its score becomes its current (decayed)
   * score plus one. Call it when the user picks, opens or runs an item.
   * Stable identity.
   */
  record: (id: T) => void;
  /**
   * Returns a sorted copy of `ids`, highest score first. Items that were
   * never recorded come last, and items with equal scores (including those
   * never recorded) keep their order from `ids`. It does not change `ids`
   * and does not add or remove anything.
   *
   * It has a new identity whenever the scores change, so it works as a
   * `useMemo` dependency.
   */
  rank: (ids: readonly T[]) => T[];
  /**
   * Returns the current score of `id`, or `0` when it was never recorded (or
   * was removed or evicted). The value shrinks as time passes, so it is only
   * meaningful next to other scores read at about the same time.
   *
   * It has a new identity whenever the scores change.
   */
  score: (id: T) => number;
  /** Forgets `id`. Nothing happens when it was never recorded. Stable identity. */
  remove: (id: T) => void;
  /** Forgets every item. Stable identity. */
  clear: () => void;
}

/**
 * Parses what was read from storage into entries by id, skipping anything that
 * is not a valid entry, so corrupt or hand-edited data can't break the hook.
 * The result is a new map that the caller may change.
 *
 * @param raw - The value read from storage.
 * @returns The valid entries.
 */
const parseStore = (raw: unknown): Map<string, StoredEntry> => {
  const entries = new Map<string, StoredEntry>();
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return entries;
  }

  for (const [id, value] of Object.entries(raw)) {
    if (typeof value !== "object" || value === null) continue;
    const { score, updatedAt } = value as Partial<StoredEntry>;
    if (
      typeof score === "number" &&
      Number.isFinite(score) &&
      score > 0 &&
      typeof updatedAt === "number" &&
      Number.isFinite(updatedAt)
    ) {
      entries.set(id, { score, updatedAt });
    }
  }

  return entries;
};

/**
 * Returns the score of an entry at a point in time. The score halves every
 * `halfLifeMs`. Time never runs backwards here: when `at` is before the
 * entry's `updatedAt` (a clock change, or an injected `now`), the entry is
 * treated as fresh instead of growing.
 *
 * @param entry - The stored entry.
 * @param at - The time to score at, in milliseconds.
 * @param halfLifeMs - The half-life, in milliseconds.
 * @returns The decayed score.
 */
const decay = (entry: StoredEntry, at: number, halfLifeMs: number) =>
  entry.score * 2 ** (-Math.max(0, at - entry.updatedAt) / halfLifeMs);

/**
 * Removes the lowest-scored entries until at most `maxItems` are left,
 * keeping `keep`. Among equal scores the entry that was used least recently
 * goes first.
 *
 * @param entries - The entries to trim. It is changed in place.
 * @param maxItems - The most entries to keep.
 * @param keep - The id that must not be removed.
 * @param at - The time to score at, in milliseconds.
 * @param halfLifeMs - The half-life, in milliseconds.
 */
const evict = (
  entries: Map<string, StoredEntry>,
  maxItems: number,
  keep: string,
  at: number,
  halfLifeMs: number
) => {
  if (entries.size <= maxItems) return;

  const excess = entries.size - maxItems;
  const candidates = [...entries]
    .filter(([id]) => id !== keep)
    .map(([id, entry]) => ({
      id,
      score: decay(entry, at, halfLifeMs),
      updatedAt: entry.updatedAt,
    }))
    .sort((a, b) => a.score - b.score || a.updatedAt - b.updatedAt);

  for (const { id } of candidates.slice(0, excess)) entries.delete(id);
};

/**
 * Ranks items by how often and how recently they were used ("frecency"), and
 * remembers it across reloads.
 *
 * Each item has a score. {@link UseFrecencyReturn.record | record} adds one to
 * it, and the score halves every {@link UseFrecencyOptions.halfLifeMs | half-life}
 * (7 days by default), so an item used many times long ago can rank below one
 * used a few times today. Use it to sort command palettes, "recent" menus,
 * search suggestions and shortcuts, where plain "most recent" or "most used"
 * lists feel off.
 *
 * Only one score and one timestamp are kept per item, so storage stays small,
 * and the oldest and least used items are dropped past
 * {@link UseFrecencyOptions.maxItems | maxItems}. Because every score decays at
 * the same rate, the order of the items never changes just because time
 * passes; it only changes when something is recorded, removed or cleared.
 *
 * The scores are kept with {@link usePersistedState}, so they survive reloads,
 * are shared by every hook that uses the same `storageKey` (also across
 * tabs), and corrupt or missing storage simply starts empty. Storage can be
 * replaced with the `storage` option. Items are identified by their string
 * form, so `1` and `"1"` are the same item.
 *
 * `record`, `remove` and `clear` have a stable identity. `rank` and `score`
 * read the current scores, so they get a new identity whenever the scores
 * change; call them while rendering, or list them as dependencies of
 * `useMemo`/`useEffect`.
 *
 * On the server, and when no storage is available, the scores live in memory
 * only and `rank` returns the ids in their given order. The stored scores are
 * read on the first client render, so a list ranked from them can differ from
 * the server HTML; render it after mounting if you hydrate it.
 *
 * @typeParam T - The type of the item ids: a string or a number.
 * @param storageKey - The key the scores are stored under.
 * @param options - Optional {@link UseFrecencyOptions | settings}.
 * @returns The {@link UseFrecencyReturn | functions} to record, rank, read and forget items.
 *
 * @example
 * ```tsx
 * const commands = [
 *   { id: "open", label: "Open file" },
 *   { id: "save", label: "Save file" },
 *   { id: "close", label: "Close tab" },
 * ];
 *
 * const { record, rank } = useFrecency<string>("command-palette");
 *
 * const byId = new Map(commands.map((command) => [command.id, command]));
 * const sorted = rank(commands.map((command) => command.id));
 *
 * return (
 *   <ul>
 *     {sorted.map((id) => (
 *       <li key={id}>
 *         <button onClick={() => record(id)}>{byId.get(id)?.label}</button>
 *       </li>
 *     ))}
 *   </ul>
 * );
 * ```
 *
 * @example
 * ```ts
 * // Favor what was used recently: scores halve every hour, and only the
 * // 20 best items are kept for this tab session.
 * const { record, score } = useFrecency<number>("recent-docs", {
 *   halfLifeMs: 60 * 60 * 1000,
 *   maxItems: 20,
 *   storage: sessionStorage,
 * });
 * ```
 *
 * @example
 * ```ts
 * // Deterministic scores in tests.
 * let time = 0;
 * const { record, score } = useFrecency<string>("test", {
 *   now: () => time,
 * });
 * ```
 *
 * For a live, editable example, see the [useFrecency docs page](https://altalyst-solutions.github.io/hookify/hooks/use-frecency).
 */
export const useFrecency = <T extends string | number>(
  storageKey: string,
  options: UseFrecencyOptions = {}
): UseFrecencyReturn<T> => {
  const { storage } = options;
  const halfLifeMs =
    typeof options.halfLifeMs === "number" &&
    Number.isFinite(options.halfLifeMs) &&
    options.halfLifeMs > 0
      ? options.halfLifeMs
      : DEFAULT_HALF_LIFE_MS;
  const maxItems =
    typeof options.maxItems === "number" && options.maxItems >= 1
      ? Math.floor(options.maxItems)
      : DEFAULT_MAX_ITEMS;

  /** The settings that `record` reads when it is called, so it can keep a stable identity. */
  const configRef = useLatest({
    halfLifeMs,
    maxItems,
    now: options.now ?? defaultNow,
  });

  const [stored, setStored] = usePersistedState<StoredFrecency>(
    storageKey,
    EMPTY_STORE,
    { storage }
  );

  /** The valid entries of the stored value. */
  const entries = useMemo(() => parseStore(stored), [stored]);

  const record = useCallback(
    (id: T) => {
      const { halfLifeMs, maxItems, now } = configRef.current;
      const key = String(id);
      // Read the clock here, not in the updater, which React may run twice.
      const at = now();

      setStored((previous) => {
        const next = parseStore(previous);
        const current = next.get(key);
        next.set(key, {
          score: (current ? decay(current, at, halfLifeMs) : 0) + 1,
          updatedAt: at,
        });
        evict(next, maxItems, key, at, halfLifeMs);
        return Object.fromEntries(next);
      });
    },
    [configRef, setStored]
  );

  const score = useCallback(
    (id: T) => {
      const entry = entries.get(String(id));
      return entry ? decay(entry, configRef.current.now(), halfLifeMs) : 0;
    },
    [entries, configRef, halfLifeMs]
  );

  const rank = useCallback(
    (ids: readonly T[]) => {
      const at = configRef.current.now();

      return ids
        .map((id, index) => {
          const entry = entries.get(String(id));
          return {
            id,
            index,
            score: entry ? decay(entry, at, halfLifeMs) : 0,
          };
        })
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(({ id }) => id);
    },
    [entries, configRef, halfLifeMs]
  );

  const remove = useCallback(
    (id: T) => {
      const key = String(id);
      setStored((previous) => {
        const next = parseStore(previous);
        next.delete(key);
        return Object.fromEntries(next);
      });
    },
    [setStored]
  );

  const clear = useCallback(() => setStored(EMPTY_STORE), [setStored]);

  return { record, rank, score, remove, clear };
};
