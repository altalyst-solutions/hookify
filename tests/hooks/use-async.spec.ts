import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useAsync } from "@/hooks";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("useAsync", () => {
  it("starts idle and does not run until asked", () => {
    const fn = vi.fn(async () => 1);
    const { result } = renderHook(() => useAsync(fn));

    expect(result.current).toMatchObject({
      status: "idle",
      data: undefined,
      error: undefined,
      isPending: false,
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it("goes pending then success and resolves with the data", async () => {
    const d = deferred<string>();
    const { result } = renderHook(() =>
      useAsync((id: string) => d.promise.then((v) => v + id))
    );

    let outcome!: Promise<unknown>;
    act(() => {
      outcome = result.current.run("!");
    });
    expect(result.current.status).toBe("pending");
    expect(result.current.isPending).toBe(true);

    await act(async () => {
      d.resolve("hi");
      await expect(outcome).resolves.toEqual({ ok: true, data: "hi!" });
    });

    expect(result.current).toMatchObject({
      status: "success",
      data: "hi!",
      error: undefined,
      isPending: false,
    });
  });

  it("captures errors without rejecting, and keeps previous data", async () => {
    const fn = vi
      .fn<(fail: boolean) => Promise<string>>()
      .mockResolvedValueOnce("ok")
      .mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useAsync(fn));

    await act(async () => {
      await result.current.run(false);
    });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.run(true);
    });

    expect(outcome).toEqual({ ok: false, error: new Error("boom") });
    expect(result.current.status).toBe("error");
    expect(result.current.error).toEqual(new Error("boom"));
    expect(result.current.data).toBe("ok");
  });

  it("clears the error and keeps data while a retry is pending", async () => {
    const d = deferred<string>();
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("x"))
      .mockReturnValueOnce(d.promise);
    const { result } = renderHook(() => useAsync(fn, { initialData: "init" }));

    await act(async () => {
      await result.current.run();
    });
    expect(result.current.error).toBeDefined();

    act(() => {
      void result.current.run();
    });
    expect(result.current.status).toBe("pending");
    expect(result.current.error).toBeUndefined();
    expect(result.current.data).toBe("init");

    await act(async () => {
      d.resolve("done");
      await d.promise;
    });
    expect(result.current.data).toBe("done");
  });

  it("only lets the latest run update the state", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const onSuccess = vi.fn();
    const fn = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useAsync(fn, { onSuccess }));

    let firstOutcome!: Promise<unknown>;
    act(() => {
      firstOutcome = result.current.run();
      void result.current.run();
    });

    await act(async () => {
      second.resolve("new");
      await second.promise;
    });
    expect(result.current.data).toBe("new");

    await act(async () => {
      first.resolve("old");
      await expect(firstOutcome).resolves.toEqual({ ok: true, data: "old" });
    });

    expect(result.current.data).toBe("new");
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith("new", []);
  });

  it("calls onSuccess and onError with the arguments", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const err = new Error("nope");
    const { result } = renderHook(() =>
      useAsync(
        async (n: number) => {
          if (n < 0) throw err;
          return n * 2;
        },
        { onSuccess, onError }
      )
    );

    await act(async () => {
      await result.current.run(2);
      await result.current.run(-1);
    });

    expect(onSuccess).toHaveBeenCalledWith(4, [2]);
    expect(onError).toHaveBeenCalledWith(err, [-1]);
  });

  it("runs on mount with immediate and the given args", async () => {
    const fn = vi.fn(async (a: number, b: number) => a + b);
    const { result } = renderHook(() =>
      useAsync(fn, { immediate: true, args: [1, 2] })
    );

    expect(result.current.status).toBe("pending");
    await act(async () => {});

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1, 2);
    expect(result.current).toMatchObject({ status: "success", data: 3 });
  });

  it("does not re-run on rerender or when the function changes", async () => {
    const first = vi.fn(async () => "a");
    const second = vi.fn(async () => "b");
    const { result, rerender } = renderHook(
      ({ fn }) => useAsync(fn, { immediate: true }),
      { initialProps: { fn: first } }
    );
    await act(async () => {});

    rerender({ fn: second });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.run();
    });
    expect(second).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe("b");
  });

  it("always uses the latest function and keeps run and reset stable", async () => {
    const { result, rerender } = renderHook(
      ({ suffix }) => useAsync(async () => `value-${suffix}`),
      { initialProps: { suffix: "a" } }
    );
    const { run, reset } = result.current;

    rerender({ suffix: "b" });
    expect(result.current.run).toBe(run);
    expect(result.current.reset).toBe(reset);

    await act(async () => {
      await run();
    });
    expect(result.current.data).toBe("value-b");
  });

  it("reset returns to idle with initialData and ignores in-flight runs", async () => {
    const d = deferred<string>();
    const { result } = renderHook(() =>
      useAsync(() => d.promise, { initialData: "init" })
    );

    act(() => {
      void result.current.run();
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current).toMatchObject({ status: "idle", data: "init" });

    await act(async () => {
      d.resolve("late");
      await d.promise;
    });
    expect(result.current).toMatchObject({ status: "idle", data: "init" });
  });

  it("does not update state or call callbacks after unmount", async () => {
    const d = deferred<string>();
    const onSuccess = vi.fn();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() =>
      useAsync(() => d.promise, { onSuccess })
    );

    let outcome!: Promise<unknown>;
    act(() => {
      outcome = result.current.run();
    });
    unmount();

    d.resolve("x");
    await expect(outcome).resolves.toEqual({ ok: true, data: "x" });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("settles on the result of the last run under StrictMode", async () => {
    const fn = vi.fn(async () => "ok");
    const { result } = renderHook(() => useAsync(fn, { immediate: true }), {
      wrapper: StrictMode,
    });
    await act(async () => {});

    expect(result.current).toMatchObject({ status: "success", data: "ok" });
  });
});
