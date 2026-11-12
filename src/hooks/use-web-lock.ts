import { useCallback, useEffect, useRef, useState } from "react";

import { useLatest } from "./use-latest";

/** Options for {@link useWebLock}. They map to the options of `navigator.locks.request`. */
export interface UseWebLockOptions {
  /**
   * `"exclusive"` lets one holder at a time own the lock, `"shared"` lets any
   * number of holders own it together. Default is `"exclusive"`.
   */
  mode?: LockMode;
  /**
   * If the lock cannot be granted immediately, skip the work: `fn` is not
   * called and `run` resolves `undefined`. Default is `false`.
   */
  ifAvailable?: boolean;
  /**
   * Release any lock with the same name held in this origin and grant this
   * request right away. The previous holder's `run` rejects with an
   * `AbortError`. Needs `"exclusive"` mode. Default is `false`.
   */
  steal?: boolean;
}

/** Per-call options for the `run` function returned by {@link useWebLock}. */
export interface UseWebLockRunOptions extends UseWebLockOptions {
  /**
   * Aborts the call. While the lock is still being waited for, `run` rejects
   * with the signal's reason. Once the lock is held, `fn` receives an
   * `AbortSignal` that follows this one. Ignored by the browser, but still
   * forwarded to `fn`, when `ifAvailable` or `steal` is set.
   */
  signal?: AbortSignal;
}

/**
 * The function {@link UseWebLockReturn.run | run} calls while holding the lock.
 *
 * @param lock - The granted `Lock`, or `null` when the Web Locks API is not
 * available and `fn` runs without a lock.
 * @param signal - Aborted when the component unmounts or the `signal` passed to
 * `run` aborts. Pass it to `fetch` or check it in loops to stop early and free
 * the lock sooner.
 */
export type WebLockCallback<T> = (
  lock: Lock | null,
  signal: AbortSignal
) => T | Promise<T>;

/** Value returned by {@link useWebLock}. */
export interface UseWebLockReturn {
  /**
   * Waits for the lock, runs `fn` while holding it, and releases the lock once
   * `fn` settles, whether it resolves or rejects. Resolves with the value
   * `fn` returns, or `undefined` if `ifAvailable` skipped the work. Rejects
   * with whatever `fn` throws, or with an `AbortError` if the request was
   * aborted (see {@link isAbortError}). It keeps a stable identity until `name`
   * changes.
   */
  run: <T>(
    fn: WebLockCallback<T>,
    options?: UseWebLockRunOptions
  ) => Promise<T | undefined>;
  /** `true` while `fn` runs holding the lock from at least one `run` call. */
  isHeld: boolean;
  /** `true` while at least one `run` call is waiting for the lock to be granted. */
  isPending: boolean;
}

/**
 * Runs async work under a named lock from the Web Locks API, so only one
 * holder at a time (`exclusive`) or any number of holders together (`shared`)
 * can execute it across tabs, windows, and workers of the same origin. Useful
 * to avoid duplicate token refreshes or concurrent writes to shared storage.
 *
 * Call `run(fn)` to wait for the lock, run `fn` while holding it, and release
 * it when `fn` resolves or rejects. `isPending` and `isHeld` report whether
 * a call is waiting for or holding the lock.
 *
 * Lock requests still waiting when the component unmounts are aborted, and
 * their `run` rejects with an `AbortError`. A lock that is already held is
 * not taken away: it lasts until `fn` settles, so use the `signal` passed
 * to `fn` to stop long work on unmount. No state is updated after unmount.
 *
 * When `navigator.locks` is missing (server rendering, unsupported browser,
 * or insecure context), `run` calls `fn(null, signal)` directly without any
 * locking, and `isHeld` stays `false`.
 *
 * @param name - The lock name. Holders of the same name in the same origin
 * contend with each other.
 * @param options - Optional default {@link UseWebLockOptions | lock} settings,
 * which each `run` call can override.
 * @returns The `run` function and the `isHeld` and `isPending` state.
 *
 * @example
 * ```tsx
 * const { run, isPending } = useWebLock("token-refresh");
 *
 * const refresh = () =>
 *   run(async () => {
 *     const token = await fetchNewToken();
 *     saveToken(token);
 *   });
 *
 * return (
 *   <button onClick={refresh} disabled={isPending}>
 *     Refresh
 *   </button>
 * );
 * ```
 *
 * @example
 * ```ts
 * // Skip the work when another tab is already doing it
 * const { run } = useWebLock("sync", { ifAvailable: true });
 *
 * const sync = async () => {
 *   const result = await run((_lock, signal) => syncData({ signal }));
 *   if (result === undefined) console.log("Another tab is syncing");
 * };
 * ```
 *
 * For a live, editable example, see the [useWebLock docs page](https://altalyst-solutions.github.io/hookify/hooks/use-web-lock).
 */
export const useWebLock = (
  name: string,
  options?: UseWebLockOptions
): UseWebLockReturn => {
  const [isHeld, setIsHeld] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const optionsRef = useLatest(options);
  const pendingCountRef = useRef(0);
  const heldCountRef = useRef(0);
  const controllersRef = useRef(new Set<AbortController>());
  const unmountedRef = useRef(false);

  const syncState = useCallback(() => {
    if (unmountedRef.current) return;
    setIsPending(pendingCountRef.current > 0);
    setIsHeld(heldCountRef.current > 0);
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    const controllers = controllersRef.current;
    return () => {
      unmountedRef.current = true;
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, []);

  const run = useCallback(
    async <T>(
      fn: WebLockCallback<T>,
      runOptions?: UseWebLockRunOptions
    ): Promise<T | undefined> => {
      const { mode, ifAvailable, steal, signal } = {
        ...optionsRef.current,
        ...runOptions,
      };

      const controller = new AbortController();
      const locks =
        typeof navigator === "undefined" ? undefined : navigator.locks;

      if (unmountedRef.current) {
        controller.abort();
      } else {
        controllersRef.current.add(controller);
      }

      const onCallerAbort = () => controller.abort(signal?.reason);
      if (signal?.aborted) {
        onCallerAbort();
      } else {
        signal?.addEventListener("abort", onCallerAbort, { once: true });
      }

      let waiting = false;
      const stopWaiting = () => {
        if (!waiting) return;
        waiting = false;
        pendingCountRef.current--;
        syncState();
      };

      try {
        if (!locks) return await fn(null, controller.signal);

        if (controller.signal.aborted) throw controller.signal.reason;

        // The browser rejects `signal` combined with `ifAvailable` or `steal`,
        // and neither of those ever waits, so there is nothing to abort.
        const lockOptions: LockOptions = {};
        if (mode) lockOptions.mode = mode;
        if (ifAvailable) lockOptions.ifAvailable = true;
        if (steal) lockOptions.steal = true;
        if (!ifAvailable && !steal) lockOptions.signal = controller.signal;

        waiting = true;
        pendingCountRef.current++;
        syncState();

        return await locks.request(name, lockOptions, async (lock) => {
          stopWaiting();
          if (!lock) return undefined;

          heldCountRef.current++;
          syncState();
          try {
            return await fn(lock, controller.signal);
          } finally {
            heldCountRef.current--;
            syncState();
          }
        });
      } finally {
        stopWaiting();
        signal?.removeEventListener("abort", onCallerAbort);
        controllersRef.current.delete(controller);
      }
    },
    [name, optionsRef, syncState]
  );

  return { run, isHeld, isPending };
};
