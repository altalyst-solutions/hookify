import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDocVisible } from "@/hooks";
import {
  type DocumentVisibilityController,
  installDocumentVisibility,
} from "@/testing";

describe("useDocVisible", () => {
  let visibility: DocumentVisibilityController;

  /** Changes the visibility inside `act()`, as the browser does when the tab is hidden or shown. */
  const setVisibility = (state: DocumentVisibilityState) =>
    act(() => {
      visibility.setVisibility(state);
    });

  beforeEach(() => {
    visibility = installDocumentVisibility();
  });

  afterEach(() => {
    visibility.restore();
  });

  it("should return true when document is initially visible", () => {
    const { result } = renderHook(() => useDocVisible());

    expect(result.current).toBe(true);
  });

  it("should return false when document is initially hidden", () => {
    setVisibility("hidden");
    const { result } = renderHook(() => useDocVisible());

    expect(result.current).toBe(false);
  });

  it("should update state when visibility changes from visible to hidden", () => {
    const { result } = renderHook(() => useDocVisible());

    expect(result.current).toBe(true);

    setVisibility("hidden");

    expect(result.current).toBe(false);
  });

  it("should update state when visibility changes from hidden to visible", () => {
    setVisibility("hidden");
    const { result } = renderHook(() => useDocVisible());

    expect(result.current).toBe(false);

    setVisibility("visible");

    expect(result.current).toBe(true);
  });

  it("should call onChange callback when visibility changes", () => {
    const onChange = vi.fn();

    renderHook(() => useDocVisible({ onChange }));

    setVisibility("hidden");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("should call onChange callback with correct values on multiple changes", () => {
    const onChange = vi.fn();

    renderHook(() => useDocVisible({ onChange }));

    setVisibility("hidden");
    expect(onChange).toHaveBeenCalledWith(false);

    setVisibility("visible");
    expect(onChange).toHaveBeenCalledWith(true);

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("should not call onChange callback on initial mount", () => {
    const onChange = vi.fn();

    renderHook(() => useDocVisible({ onChange }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("should handle onChange callback updates", () => {
    const onChange1 = vi.fn();
    const onChange2 = vi.fn();

    const { rerender } = renderHook(
      ({ callback }) => useDocVisible({ onChange: callback }),
      {
        initialProps: { callback: onChange1 },
      }
    );

    setVisibility("hidden");

    expect(onChange1).toHaveBeenCalledWith(false);
    expect(onChange2).not.toHaveBeenCalled();

    // Update the callback
    rerender({ callback: onChange2 });

    setVisibility("visible");

    expect(onChange1).toHaveBeenCalledTimes(1);
    expect(onChange2).toHaveBeenCalledWith(true);
  });

  it("should properly cleanup event listeners on unmount", () => {
    const { unmount } = renderHook(() => useDocVisible());

    expect(visibility.listenerCount).toBe(1);

    unmount();

    expect(visibility.listenerCount).toBe(0);
    expect(visibility.listenersAdded).toBe(visibility.listenersRemoved);
  });

  it("should not trigger updates after unmount", () => {
    const onChange = vi.fn();

    const { unmount } = renderHook(() => useDocVisible({ onChange }));

    unmount();

    setVisibility("hidden");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("should handle rapid visibility changes correctly", () => {
    const onChange = vi.fn();

    renderHook(() => useDocVisible({ onChange }));

    setVisibility("hidden");

    setVisibility("visible");

    setVisibility("hidden");

    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenNthCalledWith(1, false);
    expect(onChange).toHaveBeenNthCalledWith(2, true);
    expect(onChange).toHaveBeenNthCalledWith(3, false);
  });

  it("should return stable reference between re-renders when visibility doesn't change", () => {
    const { result, rerender } = renderHook(() => useDocVisible());

    const firstValue = result.current;
    rerender();
    const secondValue = result.current;

    expect(firstValue).toBe(secondValue);
  });

  it("should handle prerender visibility state", () => {
    setVisibility("prerender" as DocumentVisibilityState);
    const { result } = renderHook(() => useDocVisible());

    // prerender is not "visible", so should return false
    expect(result.current).toBe(false);

    setVisibility("visible");

    expect(result.current).toBe(true);
  });

  it("should not call onChange when visibility state is the same", () => {
    const onChange = vi.fn();

    renderHook(() => useDocVisible({ onChange }));

    // Dispatch event but keep same visibility state
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports the document as visible when rendering on the server", () => {
    // The client snapshot would be `false`; the server snapshot must win.
    setVisibility("hidden");
    const Comp = () => createElement("span", null, String(useDocVisible()));

    expect(renderToString(createElement(Comp))).toContain("true");
  });
});
