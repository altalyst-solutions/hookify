import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "@/hooks";

const setup = <T>(initial: T, delay = 200) =>
  renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
    initialProps: { value: initial, delay },
  });

describe("useDebouncedValue", () => {
  it("returns the initial value on the first render", () => {
    const { result } = setup("a");

    expect(result.current).toBe("a");
  });

  it("updates once the value has been stable for the delay", () => {
    const { result, rerender } = setup("a");

    rerender({ value: "b", delay: 200 });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("b");
  });

  it("restarts the wait on every change and emits only the last value", () => {
    const { result, rerender } = setup("a");

    rerender({ value: "b", delay: 200 });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender({ value: "c", delay: 200 });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe("c");
  });

  it("restarts the wait when the delay changes", () => {
    const { result, rerender } = setup("a");

    rerender({ value: "b", delay: 200 });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender({ value: "b", delay: 500 });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(result.current).toBe("b");
  });

  it("supports function values without calling them", () => {
    const first = () => "first";
    const second = () => "second";
    const { result, rerender } = setup(first);

    rerender({ value: second, delay: 200 });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe(second);
  });

  it("drops the pending update on unmount", () => {
    const { rerender, unmount } = setup("a");

    rerender({ value: "b", delay: 200 });
    unmount();

    expect(() => vi.advanceTimersByTime(200)).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});
