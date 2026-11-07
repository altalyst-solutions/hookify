import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useToggleState } from "@/hooks";

describe("useToggleState", () => {
  it("should initialize with default state as false", () => {
    const { result } = renderHook(() => useToggleState());

    const [state] = result.current;

    expect(state).toBe(false);
  });

  it("should initialize with the provided initial state", () => {
    const { result } = renderHook(() => useToggleState(true));

    const [state] = result.current;

    expect(state).toBe(true);
  });

  it("should toggle the state from false to true", () => {
    const { result } = renderHook(() => useToggleState());

    act(() => {
      const [, toggle] = result.current;
      toggle();
    });

    const [state] = result.current;
    expect(state).toBe(true);
  });

  it("should toggle the state from true to false", () => {
    const { result } = renderHook(() => useToggleState(true));

    act(() => {
      const [, toggle] = result.current;
      toggle();
    });

    const [state] = result.current;
    expect(state).toBe(false);
  });

  it("should toggle the state multiple times", () => {
    const { result } = renderHook(() => useToggleState());

    act(() => {
      const [, toggle] = result.current;
      toggle();
      toggle();
      toggle();
    });

    const [state] = result.current;
    expect(state).toBe(true);
  });

  it("should handle rapid toggles correctly", () => {
    const { result } = renderHook(() => useToggleState());

    act(() => {
      const [, toggle] = result.current;
      toggle();
      toggle();
      toggle();
      toggle();
    });

    const [state] = result.current;
    expect(state).toBe(false);
  });

  it("should not break when called with no arguments", () => {
    const { result } = renderHook(() => useToggleState());

    act(() => {
      const [, toggle] = result.current;
      toggle();
    });

    const [state] = result.current;
    expect(state).toBe(true);
  });

  it("should expose a setter for explicit values", () => {
    const { result } = renderHook(() => useToggleState(false));

    act(() => {
      result.current[2](true);
    });
    expect(result.current[0]).toBe(true);

    act(() => {
      result.current[2](true);
    });
    expect(result.current[0]).toBe(true);

    act(() => {
      result.current[2]((prev) => !prev);
    });
    expect(result.current[0]).toBe(false);
  });

  it("should keep toggle and setter stable across renders", () => {
    const { result } = renderHook(() => useToggleState());
    const [, toggle, setState] = result.current;

    act(() => {
      toggle();
    });

    expect(result.current[1]).toBe(toggle);
    expect(result.current[2]).toBe(setState);
  });
});
