import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useClipboard } from "@/hooks";
import { type ClipboardController, installClipboard } from "@/testing";

describe("useClipboard", () => {
  let clipboard: ClipboardController;

  beforeEach(() => {
    clipboard = installClipboard();
  });

  afterEach(() => {
    clipboard.restore();
  });

  it("starts idle", () => {
    const { result } = renderHook(() => useClipboard());
    expect(result.current.copied).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("copies text, sets copied, and resets after the default timeout", async () => {
    const { result } = renderHook(() => useClipboard());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy("hello");
    });

    expect(ok).toBe(true);
    expect(clipboard.writes).toEqual(["hello"]);
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(result.current.copied).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.copied).toBe(false);
  });

  it("respects a custom timeout", async () => {
    const { result } = renderHook(() => useClipboard({ timeout: 500 }));
    await act(async () => {
      await result.current.copy("x");
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.copied).toBe(false);
  });

  it("keeps copied true when timeout is null until reset", async () => {
    const { result } = renderHook(() => useClipboard({ timeout: null }));
    await act(async () => {
      await result.current.copy("x");
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.copied).toBe(true);

    act(() => result.current.reset());
    expect(result.current.copied).toBe(false);
  });

  it("restarts the timer on a repeated copy", async () => {
    const { result } = renderHook(() => useClipboard());
    await act(async () => {
      await result.current.copy("a");
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await result.current.copy("b");
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.copied).toBe(true);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.copied).toBe(false);
  });

  it("sets error and resolves false when the write rejects", async () => {
    const failure = new Error("denied");
    clipboard.failNext(failure);
    const onError = vi.fn();
    const onCopy = vi.fn();
    const { result } = renderHook(() => useClipboard({ onError, onCopy }));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy("x");
    });

    expect(ok).toBe(false);
    expect(result.current.copied).toBe(false);
    expect(result.current.error).toBe(failure);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(onCopy).not.toHaveBeenCalled();
  });

  it("wraps non-Error rejections in an Error", async () => {
    clipboard.failNext("nope");
    const { result } = renderHook(() => useClipboard());
    await act(async () => {
      await result.current.copy("x");
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("nope");
  });

  it("reports an error when the Clipboard API is unavailable", async () => {
    clipboard.restore();
    const { result } = renderHook(() => useClipboard());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy("x");
    });

    expect(ok).toBe(false);
    expect(result.current.error?.message).toMatch(/not available/);
  });

  it("clears a previous error on a successful copy and on reset", async () => {
    clipboard.failNext(new Error("fail"));
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy("x");
    });
    expect(result.current.error).not.toBeNull();

    await act(async () => {
      await result.current.copy("x");
    });
    expect(result.current.error).toBeNull();
    expect(result.current.copied).toBe(true);

    clipboard.failNext(new Error("fail"));
    await act(async () => {
      await result.current.copy("x");
    });
    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
  });

  it("calls onCopy with the text and uses the latest callbacks", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ onCopy }) => useClipboard({ onCopy }),
      { initialProps: { onCopy: first } }
    );
    rerender({ onCopy: second });

    await act(async () => {
      await result.current.copy("text");
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("text");
  });

  it("keeps copy and reset identities stable", () => {
    const { result, rerender } = renderHook(() => useClipboard());
    const { copy, reset } = result.current;
    rerender();
    expect(result.current.copy).toBe(copy);
    expect(result.current.reset).toBe(reset);
  });

  it("lets the latest of overlapping copies win", async () => {
    clipboard.deferNext();
    clipboard.failNext(new Error("second failed"));
    const { result } = renderHook(() => useClipboard());

    let first: Promise<boolean> = Promise.resolve(false);
    act(() => {
      first = result.current.copy("a");
    });
    await act(async () => {
      await result.current.copy("b");
    });
    await act(async () => {
      clipboard.pending[0].resolve();
      await first;
    });

    expect(result.current.copied).toBe(false);
    expect(result.current.error?.message).toBe("second failed");
  });

  it("does not update state or leave timers after unmount", async () => {
    const { result, unmount } = renderHook(() => useClipboard());
    await act(async () => {
      await result.current.copy("x");
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores a copy that resolves after unmount", async () => {
    clipboard.deferNext();
    const onCopy = vi.fn();
    const { result, unmount } = renderHook(() => useClipboard({ onCopy }));

    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = result.current.copy("x");
    });
    unmount();
    await act(async () => {
      clipboard.pending[0].resolve();
      await pending;
    });

    expect(vi.getTimerCount()).toBe(0);
  });

  it("works under StrictMode", async () => {
    const { result } = renderHook(() => useClipboard(), {
      wrapper: StrictMode,
    });
    await act(async () => {
      await result.current.copy("x");
    });
    expect(result.current.copied).toBe(true);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.copied).toBe(false);
  });
});
