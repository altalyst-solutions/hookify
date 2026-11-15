import { act, renderHook } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { UseFrecencyOptions } from "@/hooks";
import { useFrecency } from "@/hooks";

const HALF_LIFE = 1000;
const DAY = 24 * 60 * 60 * 1000;

/** An in-memory storage that records what was written to it. */
const createStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
};

type SetupOptions = Omit<UseFrecencyOptions, "storage"> & {
  storage?: ReturnType<typeof createStorage>;
};

/** Renders the hook with a controllable clock and an in-memory storage. */
const setup = (options: SetupOptions = {}, key = "test") => {
  const clock = { time: 0 };
  const storage = options.storage ?? createStorage();
  const hook = renderHook(
    (props: Omit<UseFrecencyOptions, "storage">) =>
      useFrecency<string | number>(key, {
        halfLifeMs: HALF_LIFE,
        now: () => clock.time,
        storage,
        ...props,
      }),
    { initialProps: options }
  );
  return { clock, storage, ...hook };
};

describe("useFrecency", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("starts empty: scores are 0 and rank keeps the given order", () => {
    const { result } = setup();

    expect(result.current.score("a")).toBe(0);
    expect(result.current.rank(["c", "a", "b"])).toEqual(["c", "a", "b"]);
  });

  it("adds one to the score on every record", () => {
    const { result } = setup();

    act(() => result.current.record("a"));
    expect(result.current.score("a")).toBe(1);

    act(() => result.current.record("a"));
    expect(result.current.score("a")).toBe(2);
  });

  it("counts several records made in the same batch", () => {
    const { result } = setup();

    act(() => {
      result.current.record("a");
      result.current.record("a");
      result.current.record("b");
    });

    expect(result.current.score("a")).toBe(2);
    expect(result.current.score("b")).toBe(1);
  });

  it("halves the score every half-life", () => {
    const { result, clock } = setup();

    act(() => result.current.record("a"));

    clock.time = HALF_LIFE;
    expect(result.current.score("a")).toBeCloseTo(0.5);

    clock.time = 3 * HALF_LIFE;
    expect(result.current.score("a")).toBeCloseTo(0.125);
  });

  it("adds the new use to the decayed score", () => {
    const { result, clock } = setup();

    act(() => result.current.record("a"));
    clock.time = HALF_LIFE;
    act(() => result.current.record("a"));

    expect(result.current.score("a")).toBeCloseTo(1.5);
  });

  it("does not let a score grow when the clock moves backwards", () => {
    const { result, clock } = setup();

    clock.time = 5000;
    act(() => result.current.record("a"));
    clock.time = 0;

    expect(result.current.score("a")).toBe(1);
  });

  it("ranks by score, highest first, without changing the input", () => {
    const { result } = setup();
    const ids = ["a", "b", "c"];

    act(() => {
      result.current.record("c");
      result.current.record("b");
      result.current.record("b");
    });

    const ranked = result.current.rank(ids);
    expect(ranked).toEqual(["b", "c", "a"]);
    expect(ranked).not.toBe(ids);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("puts unknown ids last and keeps their order, and keeps the order of equal scores", () => {
    const { result } = setup();

    act(() => {
      result.current.record("known");
      result.current.record("tie-1");
      result.current.record("tie-2");
    });

    expect(
      result.current.rank(["x", "tie-2", "y", "known", "tie-1", "z"])
    ).toEqual(["tie-2", "known", "tie-1", "x", "y", "z"]);
  });

  it("lets a recent use outrank older, more frequent use", () => {
    const { result, clock } = setup();

    act(() => {
      for (let i = 0; i < 4; i++) result.current.record("often");
    });
    clock.time = 10 * HALF_LIFE;
    act(() => result.current.record("recent"));

    expect(result.current.rank(["often", "recent"])).toEqual([
      "recent",
      "often",
    ]);
  });

  it("keeps the order of items when only time passes", () => {
    const { result, clock } = setup();

    act(() => {
      result.current.record("a");
      result.current.record("a");
    });
    clock.time = 2 * HALF_LIFE;
    act(() => result.current.record("b"));
    const before = result.current.rank(["a", "b"]);

    clock.time = 50 * HALF_LIFE;
    expect(result.current.rank(["a", "b"])).toEqual(before);
  });

  it("treats numbers and their string form as the same item", () => {
    const { result } = setup();

    act(() => result.current.record(1));
    act(() => result.current.record("1"));

    expect(result.current.score(1)).toBe(2);
    expect(result.current.rank([2, "1", 3])).toEqual(["1", 2, 3]);
  });

  it("treats ids such as constructor and __proto__ as ordinary ids", () => {
    const { result, storage } = setup();

    expect(result.current.score("constructor")).toBe(0);

    act(() => {
      result.current.record("__proto__");
      result.current.record("constructor");
    });

    expect(result.current.score("__proto__")).toBe(1);
    expect(result.current.score("constructor")).toBe(1);
    expect(result.current.score("toString")).toBe(0);

    const reloaded = renderHook(() =>
      useFrecency<string>("test", { now: () => 0, storage })
    );
    expect(reloaded.result.current.score("__proto__")).toBe(1);
  });

  describe("removing", () => {
    it("forgets a single item", () => {
      const { result } = setup();

      act(() => {
        result.current.record("a");
        result.current.record("b");
      });
      act(() => result.current.remove("a"));

      expect(result.current.score("a")).toBe(0);
      expect(result.current.score("b")).toBe(1);
    });

    it("does nothing for an item that was never recorded", () => {
      const { result } = setup();

      act(() => result.current.record("a"));
      act(() => result.current.remove("missing"));

      expect(result.current.score("a")).toBe(1);
    });

    it("forgets everything with clear", () => {
      const { result } = setup();

      act(() => {
        result.current.record("a");
        result.current.record("b");
      });
      act(() => result.current.clear());

      expect(result.current.rank(["b", "a"])).toEqual(["b", "a"]);
      expect(result.current.score("a")).toBe(0);
    });
  });

  describe("maxItems", () => {
    it("removes the lowest-scored items past the limit", () => {
      const { result } = setup({ maxItems: 2 });

      act(() => {
        result.current.record("a");
        result.current.record("a");
        result.current.record("b");
      });
      act(() => result.current.record("c"));

      expect(result.current.score("a")).toBe(2);
      expect(result.current.score("b")).toBe(0);
      expect(result.current.score("c")).toBe(1);
    });

    it("removes the least recently used of equal scores", () => {
      const { result, clock } = setup({ maxItems: 2 });

      act(() => result.current.record("old"));
      clock.time = 100;
      act(() => result.current.record("newer"));
      clock.time = 200;
      act(() => result.current.record("newest"));

      expect(result.current.score("old")).toBe(0);
      expect(result.current.score("newer")).toBeGreaterThan(0);
      expect(result.current.score("newest")).toBe(1);
    });

    it("never removes the item that was just recorded", () => {
      const { result } = setup({ maxItems: 1 });

      act(() => {
        result.current.record("a");
        result.current.record("a");
      });
      act(() => result.current.record("b"));

      expect(result.current.score("a")).toBe(0);
      expect(result.current.score("b")).toBe(1);
    });

    it("rounds a fractional limit down", () => {
      const { result } = setup({ maxItems: 2.9 });

      act(() => {
        result.current.record("a");
        result.current.record("b");
        result.current.record("c");
      });

      const kept = ["a", "b", "c"].filter((id) => result.current.score(id));
      expect(kept).toHaveLength(2);
    });

    it("keeps everything with Infinity", () => {
      const { result } = setup({ maxItems: Infinity });

      act(() => {
        for (let i = 0; i < 150; i++) result.current.record(i);
      });

      expect(result.current.score(0)).toBe(1);
      expect(result.current.score(149)).toBe(1);
    });

    it.each([0, -5, NaN])("falls back to 100 for %s", (maxItems) => {
      const { result } = setup({ maxItems });

      act(() => {
        for (let i = 0; i < 101; i++) result.current.record(i);
      });

      const kept = Array.from({ length: 101 }, (_, i) => i).filter((id) =>
        result.current.score(id)
      );
      expect(kept).toHaveLength(100);
    });
  });

  describe("halfLifeMs", () => {
    it.each([0, -1, NaN, Infinity])(
      "falls back to 7 days for %s",
      (halfLifeMs) => {
        const { result, clock } = setup({ halfLifeMs });

        act(() => result.current.record("a"));
        clock.time = 7 * DAY;

        expect(result.current.score("a")).toBeCloseTo(0.5);
      }
    );

    it("uses the new value when it changes", () => {
      const { result, rerender, clock } = setup();

      act(() => result.current.record("a"));
      clock.time = HALF_LIFE;
      rerender({ halfLifeMs: 2 * HALF_LIFE });

      expect(result.current.score("a")).toBeCloseTo(Math.SQRT1_2);
    });
  });

  describe("clock", () => {
    it("uses Date.now by default", () => {
      vi.setSystemTime(0);
      const storage = createStorage();
      const { result } = renderHook(() =>
        useFrecency<string>("test", { halfLifeMs: HALF_LIFE, storage })
      );

      act(() => result.current.record("a"));
      vi.setSystemTime(HALF_LIFE);

      expect(result.current.score("a")).toBeCloseTo(0.5);
    });

    it("picks up a new now function", () => {
      const { result, rerender } = setup();

      act(() => result.current.record("a"));
      rerender({ now: () => HALF_LIFE });

      expect(result.current.score("a")).toBeCloseTo(0.5);
    });
  });

  describe("persistence", () => {
    it("writes the scores to the storage", () => {
      const { result, storage, clock } = setup();

      clock.time = 42;
      act(() => result.current.record("a"));

      expect(JSON.parse(storage.data.get("test") ?? "null")).toEqual({
        a: { score: 1, updatedAt: 42 },
      });
    });

    it("restores the scores in a new hook instance", () => {
      const first = setup();
      act(() => first.result.current.record("a"));
      act(() => first.result.current.record("a"));
      first.unmount();

      const second = setup({ storage: first.storage });

      expect(second.result.current.score("a")).toBe(2);
    });

    it("uses localStorage by default", () => {
      const { result } = renderHook(() =>
        useFrecency<string>("default-storage", { now: () => 0 })
      );

      act(() => result.current.record("a"));

      expect(localStorage.getItem("default-storage")).toContain('"a"');
    });

    it("keeps separate scores for separate keys", () => {
      const storage = createStorage();
      const one = setup({ storage }, "one");
      const two = setup({ storage }, "two");

      act(() => one.result.current.record("a"));

      expect(two.result.current.score("a")).toBe(0);
    });

    it("keeps hooks with the same key in sync", () => {
      const storage = createStorage();
      const one = setup({ storage });
      const two = setup({ storage });

      act(() => one.result.current.record("a"));

      expect(two.result.current.score("a")).toBe(1);
    });

    it("starts empty when the stored value is not valid JSON", () => {
      const storage = createStorage({ test: "{not json" });
      const { result } = setup({ storage });

      expect(result.current.score("a")).toBe(0);

      act(() => result.current.record("a"));
      expect(result.current.score("a")).toBe(1);
    });

    it.each([
      ["an array", "[1,2]"],
      ["a string", '"text"'],
      ["null", "null"],
      ["a number", "7"],
    ])("starts empty when the stored value is %s", (_, value) => {
      const { result } = setup({ storage: createStorage({ test: value }) });

      expect(result.current.score("a")).toBe(0);
    });

    it("ignores entries that are not valid and keeps the rest", () => {
      const storage = createStorage({
        test: JSON.stringify({
          good: { score: 3, updatedAt: 0 },
          noTime: { score: 3 },
          noScore: { updatedAt: 0 },
          zero: { score: 0, updatedAt: 0 },
          negative: { score: -1, updatedAt: 0 },
          text: { score: "3", updatedAt: 0 },
          primitive: 5,
          empty: null,
        }),
      });
      const { result } = setup({ storage });

      expect(result.current.score("good")).toBe(3);
      for (const id of [
        "noTime",
        "noScore",
        "zero",
        "negative",
        "text",
        "primitive",
        "empty",
      ]) {
        expect(result.current.score(id)).toBe(0);
      }
    });
  });

  describe("identity", () => {
    it("keeps record, remove and clear stable across renders and changes", () => {
      const { result, rerender } = setup();
      const { record, remove, clear } = result.current;

      act(() => record("a"));
      rerender({});
      act(() => remove("a"));

      expect(result.current.record).toBe(record);
      expect(result.current.remove).toBe(remove);
      expect(result.current.clear).toBe(clear);
    });

    it("keeps rank and score while nothing changes and replaces them when the scores change", () => {
      const { result, rerender } = setup();
      const { rank, score } = result.current;

      rerender({});
      expect(result.current.rank).toBe(rank);
      expect(result.current.score).toBe(score);

      act(() => result.current.record("a"));
      expect(result.current.rank).not.toBe(rank);
      expect(result.current.score).not.toBe(score);
    });
  });

  it("works under StrictMode", () => {
    const storage = createStorage();
    const { result } = renderHook(
      () => useFrecency<string>("test", { now: () => 0, storage }),
      { wrapper: StrictMode }
    );

    act(() => result.current.record("a"));

    expect(result.current.score("a")).toBe(1);
  });

  it("ranks in the given order when rendered on the server", () => {
    const Component = () => {
      const { rank } = useFrecency<string>("ssr");
      return createElement("p", null, rank(["b", "a", "c"]).join(","));
    };

    expect(renderToString(createElement(Component))).toContain("b,a,c");
  });
});
