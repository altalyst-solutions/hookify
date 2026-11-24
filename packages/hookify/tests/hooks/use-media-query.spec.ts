import { act, renderHook } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMediaQuery } from "@/hooks";
import { installMatchMedia, type MatchMediaController } from "@/testing";

describe("useMediaQuery", () => {
  let media: MatchMediaController;

  /** Changes a query inside `act()`, as the browser does when the viewport changes. */
  const setMatch = (query: string, matches: boolean) =>
    act(() => {
      media.setMatches(query, matches);
    });

  beforeEach(() => {
    media = installMatchMedia();
  });

  afterEach(() => {
    media.restore();
  });

  it("returns the current match state", () => {
    media.setMatches("(min-width: 600px)", true);
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
    media.setMatches("(a)", true);
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
    expect(media.listenerCount("(a)")).toBe(1);

    rerender({ q: "(b)" });
    expect(media.listenerCount("(a)")).toBe(0);
    expect(media.listenerCount("(b)")).toBe(1);

    unmount();
    expect(media.listenerCount()).toBe(0);
  });

  it("returns defaultValue when matchMedia is unavailable", () => {
    media.restore();
    const { result } = renderHook(() =>
      useMediaQuery("(a)", { defaultValue: true })
    );
    expect(result.current).toBe(true);
  });

  it("defaults to false when matchMedia is unavailable", () => {
    media.restore();
    const { result } = renderHook(() => useMediaQuery("(a)"));
    expect(result.current).toBe(false);
  });

  it("uses defaultValue on the server", () => {
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
    const added = media.listenersAdded;

    rerender({ cb: second });
    expect(media.listenersAdded).toBe(added);

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
