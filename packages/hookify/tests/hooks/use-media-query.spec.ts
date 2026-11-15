import { act, renderHook } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMediaQuery } from "@/hooks";

class MockMql extends EventTarget {
  matches: boolean;
  constructor(
    readonly media: string,
    matches: boolean
  ) {
    super();
    this.matches = matches;
  }
}

describe("useMediaQuery", () => {
  let lists: Map<string, MockMql>;
  let state: Map<string, boolean>;

  const setMatch = (query: string, matches: boolean) => {
    state.set(query, matches);
    const mql = lists.get(query);
    if (mql) {
      mql.matches = matches;
      act(() => {
        mql.dispatchEvent(new Event("change"));
      });
    }
  };

  beforeEach(() => {
    lists = new Map();
    state = new Map();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => {
        let mql = lists.get(query);
        if (!mql) {
          mql = new MockMql(query, state.get(query) ?? false);
          lists.set(query, mql);
        }
        return mql;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the current match state", () => {
    state.set("(min-width: 600px)", true);
    const { result } = renderHook(() => useMediaQuery("(min-width: 600px)"));
    expect(result.current).toBe(true);
  });

  it("returns false when the query does not match", () => {
    const { result } = renderHook(() => useMediaQuery("(min-width: 600px)"));
    expect(result.current).toBe(false);
  });

  it("updates when the match state changes", () => {
    const q = "(min-width: 600px)";
    const { result } = renderHook(() => useMediaQuery(q));
    expect(result.current).toBe(false);

    setMatch(q, true);
    expect(result.current).toBe(true);

    setMatch(q, false);
    expect(result.current).toBe(false);
  });

  it("re-evaluates when the query changes", () => {
    state.set("(a)", true);
    state.set("(b)", false);
    const { result, rerender } = renderHook(({ q }) => useMediaQuery(q), {
      initialProps: { q: "(a)" },
    });
    expect(result.current).toBe(true);

    rerender({ q: "(b)" });
    expect(result.current).toBe(false);
  });

  it("removes the listener on unmount and on query change", () => {
    const { rerender, unmount } = renderHook(({ q }) => useMediaQuery(q), {
      initialProps: { q: "(a)" },
    });
    const a = lists.get("(a)")!;
    const removeA = vi.spyOn(a, "removeEventListener");

    rerender({ q: "(b)" });
    expect(removeA).toHaveBeenCalledWith("change", expect.any(Function));

    const b = lists.get("(b)")!;
    const removeB = vi.spyOn(b, "removeEventListener");
    unmount();
    expect(removeB).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("returns defaultValue when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() =>
      useMediaQuery("(a)", { defaultValue: true })
    );
    expect(result.current).toBe(true);
  });

  it("defaults to false when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useMediaQuery("(a)"));
    expect(result.current).toBe(false);
  });

  it("uses defaultValue on the server", () => {
    state.set("(a)", false);
    const Comp = () =>
      createElement(
        "span",
        null,
        String(useMediaQuery("(a)", { defaultValue: true }))
      );
    expect(renderToString(createElement(Comp))).toContain("true");
  });

  it("calls onChange on changes but not on mount", () => {
    const onChange = vi.fn();
    const q = "(a)";
    renderHook(() => useMediaQuery(q, { onChange }));
    expect(onChange).not.toHaveBeenCalled();

    setMatch(q, true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(true);

    setMatch(q, false);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("uses the latest onChange without re-subscribing", () => {
    const first = vi.fn();
    const second = vi.fn();
    const q = "(a)";
    const { rerender } = renderHook(
      ({ cb }) => useMediaQuery(q, { onChange: cb }),
      { initialProps: { cb: first } }
    );
    const add = vi.spyOn(lists.get(q)!, "addEventListener");
    rerender({ cb: second });
    expect(add).not.toHaveBeenCalled();

    setMatch(q, true);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(true);
  });

  it("works under StrictMode", () => {
    const q = "(a)";
    const { result } = renderHook(() => useMediaQuery(q), {
      wrapper: StrictMode,
    });
    setMatch(q, true);
    expect(result.current).toBe(true);
  });
});
