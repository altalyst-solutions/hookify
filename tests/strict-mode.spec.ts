import { act, renderHook } from "@testing-library/react";
import type { Mock } from "vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useApi,
  useDebounce,
  useDocVisible,
  useEffectAfterMount,
  useMounted,
  usePersistedState,
  useToggleState,
} from "@/hooks";

// StrictMode double-invokes effects (mount -> unmount -> mount) in React 18 and 19.
// These tests assert hooks keep correct behaviour under that, without the exact
// call counts the regular specs rely on.
const strict = { reactStrictMode: true };

describe("hooks under StrictMode", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("useEffectAfterMount skips the initial mount and runs on updates", () => {
    const fn = vi.fn();
    const { rerender } = renderHook(
      ({ dep }) => useEffectAfterMount(fn, [dep]),
      { initialProps: { dep: 1 }, ...strict }
    );

    expect(fn).not.toHaveBeenCalled();

    rerender({ dep: 2 });
    expect(fn).toHaveBeenCalled();
  });

  it("useMounted reports mounted and balances onMount/onUnmount", () => {
    const onMount = vi.fn();
    const onUnmount = vi.fn();
    const { result, unmount } = renderHook(
      () => useMounted({ onMount, onUnmount }),
      strict
    );

    expect(result.current()).toBe(true);
    expect(onMount.mock.calls.length).toBe(onUnmount.mock.calls.length + 1);

    unmount();
    expect(result.current()).toBe(false);
    expect(onMount.mock.calls.length).toBe(onUnmount.mock.calls.length);
  });

  it("useDebounce still fires the callback once after the delay", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, 100), strict);

    act(() => {
      result.current("a");
      result.current("b");
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("b");
  });

  it("useToggleState toggles correctly", () => {
    const { result } = renderHook(() => useToggleState(false), strict);

    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
  });

  it("usePersistedState reads and persists values", () => {
    localStorage.setItem("k", JSON.stringify("stored"));
    const { result } = renderHook(() => usePersistedState("k", "init"), strict);

    expect(result.current[0]).toBe("stored");

    act(() => result.current[1]("next"));
    expect(result.current[0]).toBe("next");
    expect(localStorage.getItem("k")).toBe(JSON.stringify("next"));
  });

  it("useDocVisible returns the current visibility", () => {
    const { result } = renderHook(() => useDocVisible(), strict);

    expect(result.current).toBe(true);
  });

  it("useApi settles with the fetched data despite the duplicate fetch", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { result } = renderHook(
      () => useApi<{ success: boolean }>("https://api.example.com/data"),
      strict
    );
    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({ success: true });
    expect((fetch as Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
