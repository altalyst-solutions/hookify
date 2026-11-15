import { useCallback, useEffect, useRef, useState } from "react";

import { useLatest } from "./use-latest";

/** The lifecycle phase of an async function run by {@link useAsync}. */
export type AsyncStatus = "idle" | "pending" | "success" | "error";

/**
 * The outcome of a call to {@link UseAsyncReturn.run}, reported as a value so
 * `run` never rejects.
 * @typeParam T - The type of data the async function resolves with.
 * @typeParam E - The type of error the async function rejects with.
 */
export type AsyncResult<T, E = unknown> =
  { ok: true; data: T } | { ok: false; error: E };

/**
 * Options for {@link useAsync}.
 * @typeParam T - The type of data the async function resolves with.
 * @typeParam A - The argument list of the async function.
 * @typeParam E - The type of error the async function rejects with.
 */
export interface UseAsyncOptions<T, A extends unknown[], E = unknown> {
  /**
   * Run the async function once on mount, with {@link UseAsyncOptions.args}.
   * Default is `false`. Later runs are always triggered with `run`.
   */
  immediate?: boolean;
  /** Arguments for the `immediate` run on mount. */
  args?: A;
  /** The `data` before the first success, and after `reset`. Default is `undefined`. */
  initialData?: T;
  /** Called with the result and the arguments when a run succeeds. Ignored for stale runs and after unmount. */
  onSuccess?: (data: T, args: A) => void;
  /** Called with the error and the arguments when a run fails. Ignored for stale runs and after unmount. */
  onError?: (error: E, args: A) => void;
}

/**
 * The return value of {@link useAsync}.
 * @typeParam T - The type of data the async function resolves with.
 * @typeParam A - The argument list of the async function.
 * @typeParam E - The type of error the async function rejects with.
 */
export interface UseAsyncReturn<T, A extends unknown[], E = unknown> {
  /** The lifecycle phase: `idle` until the first run, then `pending`, `success` or `error`. */
  status: AsyncStatus;
  /** The latest successful result. It is kept while a new run is pending or after one fails. */
  data: T | undefined;
  /** The error of the latest run, or `undefined` while it is pending or after it succeeds. */
  error: E | undefined;
  /** Shorthand for `status === "pending"`. */
  isPending: boolean;
  /**
   * Run the async function with the given arguments. Resolves with the
   * outcome instead of rejecting. If a newer run starts first, this one still
   * resolves with its own outcome but no longer updates the state.
   */
  run: (...args: A) => Promise<AsyncResult<T, E>>;
  /** Go back to `idle` with `initialData`, and ignore any run still in flight. */
  reset: () => void;
}

interface AsyncState<T, E> {
  status: AsyncStatus;
  data: T | undefined;
  error: E | undefined;
}

/**
 * Runs an async function and tracks its `status`, `data` and `error`.
 *
 * Nothing runs until you call `run`, unless you set `immediate`. Only the
 * latest run updates the state, so a slow earlier call can never overwrite a
 * newer result. `run` never rejects; it resolves with an {@link AsyncResult},
 * so event handlers need no `try`/`catch`. The latest `asyncFn`, `onSuccess`
 * and `onError` are always used, so inline functions are safe, and `run` and
 * `reset` keep the same identity across renders. State is never updated after
 * unmount.
 *
 * It does not abort the underlying work. To cancel a request when a new one
 * starts, use `useSequentialRequest`; to fetch JSON from a URL, use `useApi`.
 * Under React `StrictMode` in development, `immediate` runs the function twice.
 *
 * @typeParam T - The type of data the async function resolves with.
 * @typeParam A - The argument list of the async function.
 * @typeParam E - The type of error the async function rejects with. Default is `unknown`.
 * @param asyncFn - The function to run. It receives the arguments passed to `run`.
 * @param options - Optional {@link UseAsyncOptions | behavior} flags and callbacks.
 * @returns The {@link UseAsyncReturn | state and controls} of the async function.
 *
 * @example
 * ```tsx
 * const { run, data, error, isPending } = useAsync(
 *   (id: string) => fetchUser(id)
 * );
 *
 * <button onClick={() => run("42")} disabled={isPending}>Load</button>
 * ```
 *
 * @example
 * ```tsx
 * // Run on mount, and react to the outcome
 * const { data, status, run } = useAsync(loadSettings, {
 *   immediate: true,
 *   onError: (error) => reportError(error),
 * });
 * ```
 *
 * For a live, editable example, see the [useAsync docs page](https://altalyst-solutions.github.io/hookify/hooks/use-async).
 */
export const useAsync = <T, A extends unknown[] = [], E = unknown>(
  asyncFn: (...args: A) => Promise<T>,
  options: UseAsyncOptions<T, A, E> = {}
): UseAsyncReturn<T, A, E> => {
  const { immediate = false, initialData } = options;

  const [state, setState] = useState<AsyncState<T, E>>({
    status: immediate ? "pending" : "idle",
    data: initialData,
    error: undefined,
  });

  const asyncFnRef = useLatest(asyncFn);
  const optionsRef = useLatest(options);
  const runId = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const execute = useCallback(
    async (args: A, markPending: boolean): Promise<AsyncResult<T, E>> => {
      const id = ++runId.current;
      const isCurrent = () => mounted.current && id === runId.current;

      if (markPending) {
        setState((prev) => ({ ...prev, status: "pending", error: undefined }));
      }

      try {
        const data = await asyncFnRef.current(...args);
        if (isCurrent()) {
          setState({ status: "success", data, error: undefined });
          optionsRef.current.onSuccess?.(data, args);
        }
        return { ok: true, data };
      } catch (error) {
        if (isCurrent()) {
          setState((prev) => ({
            status: "error",
            data: prev.data,
            error: error as E,
          }));
          optionsRef.current.onError?.(error as E, args);
        }
        return { ok: false, error: error as E };
      }
    },
    [asyncFnRef, optionsRef]
  );

  const run = useCallback((...args: A) => execute(args, true), [execute]);

  const reset = useCallback(() => {
    runId.current++;
    setState({
      status: "idle",
      data: optionsRef.current.initialData,
      error: undefined,
    });
  }, [optionsRef]);

  // The initial state is already `pending`, so the mount run skips the update.
  useEffect(() => {
    if (immediate) {
      void execute(optionsRef.current.args ?? ([] as unknown as A), false);
    }
    // Only the mount value of `immediate` matters; later runs use `run`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status: state.status,
    data: state.data,
    error: state.error,
    isPending: state.status === "pending",
    run,
    reset,
  };
};
