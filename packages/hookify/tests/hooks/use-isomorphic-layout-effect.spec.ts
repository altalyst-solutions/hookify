import { renderHook } from "@testing-library/react";
import { createElement, useEffect } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsomorphicLayoutEffect } from "@/hooks";

describe("useIsomorphicLayoutEffect", () => {
  it("runs the effect after mount", () => {
    const effect = vi.fn();

    renderHook(() => useIsomorphicLayoutEffect(effect, []));

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("runs before passive effects, even when declared after them", () => {
    const order: string[] = [];

    renderHook(() => {
      useEffect(() => {
        order.push("passive");
      }, []);
      useIsomorphicLayoutEffect(() => {
        order.push("layout");
      }, []);
    });

    expect(order).toEqual(["layout", "passive"]);
  });

  it("re-runs only when dependencies change and cleans up between runs", () => {
    const cleanup = vi.fn();
    const effect = vi.fn(() => cleanup);
    const { rerender, unmount } = renderHook(
      ({ dep }) => useIsomorphicLayoutEffect(effect, [dep]),
      { initialProps: { dep: 1 } }
    );

    rerender({ dep: 1 });
    expect(effect).toHaveBeenCalledTimes(1);
    expect(cleanup).not.toHaveBeenCalled();

    rerender({ dep: 2 });
    expect(effect).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(1);

    unmount();
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("runs on every render when no dependencies are given", () => {
    const effect = vi.fn();
    const { rerender } = renderHook(() => useIsomorphicLayoutEffect(effect));

    rerender();
    rerender();

    expect(effect).toHaveBeenCalledTimes(3);
  });

  it("is useLayoutEffect when a DOM is available", async () => {
    vi.resetModules();
    const react = await import("react");
    const mod = await import("@/hooks/use-isomorphic-layout-effect");

    expect(mod.useIsomorphicLayoutEffect).toBe(react.useLayoutEffect);
  });

  describe("without a DOM", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
      vi.resetModules();
    });

    it("falls back to useEffect when window is undefined", async () => {
      vi.stubGlobal("window", undefined);
      vi.resetModules();
      const react = await import("react");
      const mod = await import("@/hooks/use-isomorphic-layout-effect");

      expect(mod.useIsomorphicLayoutEffect).toBe(react.useEffect);
    });

    it("falls back to useEffect when window has no document (React Native)", async () => {
      vi.stubGlobal("window", {});
      vi.resetModules();
      const react = await import("react");
      const mod = await import("@/hooks/use-isomorphic-layout-effect");

      expect(mod.useIsomorphicLayoutEffect).toBe(react.useEffect);
    });

    it("renders on the server without warnings", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubGlobal("window", undefined);
      vi.resetModules();
      const effect = vi.fn();
      const { useIsomorphicLayoutEffect: hook } =
        await import("@/hooks/use-isomorphic-layout-effect");

      const html = renderToString(
        createElement(() => {
          hook(effect, []);
          return createElement("p", null, "hello");
        })
      );

      expect(html).toBe("<p>hello</p>");
      expect(effect).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });
  });
});
