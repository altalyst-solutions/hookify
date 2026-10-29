import { act, render, renderHook } from "@testing-library/react";
import {
  createElement,
  Fragment,
  memo,
  StrictMode,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { useStableCallback } from "@/hooks";

const h = createElement;

describe("useStableCallback", () => {
  it("calls the callback with the given arguments and returns its result", () => {
    const callback = vi.fn((a: number, b: number) => a + b);
    const { result } = renderHook(() => useStableCallback(callback));

    expect(result.current(1, 2)).toBe(3);
    expect(callback).toHaveBeenCalledWith(1, 2);
  });

  it("keeps the same identity across renders", () => {
    const { result, rerender } = renderHook(({ cb }) => useStableCallback(cb), {
      initialProps: { cb: (): number => 1 },
    });
    const first = result.current;

    rerender({ cb: () => 2 });

    expect(result.current).toBe(first);
  });

  it("always calls the latest callback", () => {
    const first = vi.fn(() => "first");
    const second = vi.fn(() => "second");
    const { result, rerender } = renderHook(({ cb }) => useStableCallback(cb), {
      initialProps: { cb: first },
    });
    const stable = result.current;

    rerender({ cb: second });

    expect(stable()).toBe("second");
    expect(first).not.toHaveBeenCalled();
  });

  it("reads the latest props and state from a handler created earlier", () => {
    const seen: number[] = [];
    const { result, rerender } = renderHook(
      ({ count }) => useStableCallback(() => seen.push(count)),
      { initialProps: { count: 0 } }
    );
    const stable = result.current;

    rerender({ count: 1 });
    rerender({ count: 2 });
    stable();

    expect(seen).toEqual([2]);
  });

  it("uses the latest callback inside a layout effect and an effect", () => {
    const calls: string[] = [];
    const Probe = ({ label }: { label: string }) => {
      const log = useStableCallback((phase: string) =>
        calls.push(`${phase}:${label}`)
      );
      useLayoutEffect(() => {
        log("layout");
      }, [log, label]);
      useEffect(() => {
        log("effect");
      }, [log, label]);
      return null;
    };

    const { rerender } = render(h(Probe, { label: "a" }));
    rerender(h(Probe, { label: "b" }));

    expect(calls).toEqual(["layout:a", "effect:a", "layout:b", "effect:b"]);
  });

  it("lets a subscription created once call the latest handler", () => {
    const received: string[] = [];
    const subscribe = vi.fn();
    const Subscriber = ({ prefix }: { prefix: string }) => {
      const onEvent = useStableCallback((value: string) =>
        received.push(`${prefix}${value}`)
      );
      useEffect(() => {
        subscribe();
        const listener = (e: Event) => onEvent((e as CustomEvent).detail);
        window.addEventListener("ping", listener);
        return () => window.removeEventListener("ping", listener);
      }, [onEvent]);
      return null;
    };

    const { rerender } = render(h(Subscriber, { prefix: "a-" }));
    rerender(h(Subscriber, { prefix: "b-" }));
    act(() => {
      window.dispatchEvent(new CustomEvent("ping", { detail: "x" }));
    });

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(received).toEqual(["b-x"]);
  });

  it("does not re-render a memoized child when only the callback changes", () => {
    const renders = vi.fn();
    const Child = memo(function Child(props: { onPick: (n: number) => void }) {
      renders();
      // eslint-disable-next-line react/prop-types -- props are typed with TypeScript.
      return h("button", { onClick: () => props.onPick(1) }, "pick");
    });
    const Parent = () => {
      const [count, setCount] = useState(0);
      const onPick = useStableCallback((n: number) => setCount(count + n));
      return h(
        Fragment,
        null,
        h("output", null, count),
        h(Child, { onPick }),
        h("button", { onClick: () => setCount((c) => c + 10) }, "bump")
      );
    };

    const { getByText } = render(h(Parent));
    act(() => getByText("bump").click());
    act(() => getByText("pick").click());

    expect(getByText("11")).toBeTruthy();
    expect(renders).toHaveBeenCalledTimes(1);
  });

  it("passes `this` through to the callback", () => {
    function getName(this: { name: string }) {
      return this.name;
    }
    const { result } = renderHook(() => useStableCallback(getName));
    const obj = { name: "obj", getName: result.current };

    expect(obj.getName()).toBe("obj");
  });

  it("does nothing and returns undefined when the callback is missing", () => {
    const { result } = renderHook(() =>
      useStableCallback(undefined as ((n: number) => number) | undefined)
    );

    expect(result.current(1)).toBeUndefined();
  });

  it("starts and stops calling as an optional callback comes and goes", () => {
    const callback = vi.fn(() => "called");
    const { result, rerender } = renderHook(
      ({ cb }: { cb: (() => string) | null }) => useStableCallback(cb),
      { initialProps: { cb: null as (() => string) | null } }
    );
    const stable = result.current;

    expect(stable()).toBeUndefined();

    rerender({ cb: callback });
    expect(stable()).toBe("called");

    rerender({ cb: null });
    expect(stable()).toBeUndefined();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("propagates errors thrown by the callback", () => {
    const { result } = renderHook(() =>
      useStableCallback(() => {
        throw new Error("boom");
      })
    );

    expect(() => result.current()).toThrow("boom");
  });

  it("preserves the callback's type", () => {
    const { result } = renderHook(() =>
      useStableCallback((id: string, n: number) => `${id}${n}`)
    );
    expectTypeOf(result.current).toEqualTypeOf<
      (id: string, n: number) => string
    >();

    const optional = renderHook(() =>
      useStableCallback(undefined as ((id: string) => number) | undefined)
    );
    expectTypeOf(optional.result.current).toEqualTypeOf<
      (id: string) => number | undefined
    >();
  });

  it("behaves correctly under StrictMode", () => {
    const callback = vi.fn((n: number) => n * 2);
    const { result, rerender } = renderHook(({ cb }) => useStableCallback(cb), {
      initialProps: { cb: callback },
      wrapper: StrictMode,
    });
    const stable = result.current;

    const next = vi.fn((n: number) => n * 3);
    rerender({ cb: next });

    expect(result.current).toBe(stable);
    expect(stable(2)).toBe(6);
    expect(callback).not.toHaveBeenCalled();
  });
});
