import { replaceProperty } from "./replace-global";

/** What the fake lock manager knows about one lock, held or waiting. */
export interface LockInfo {
  /** The lock's name. */
  readonly name: string;
  /** Whether it is exclusive or shared. */
  readonly mode: LockMode;
}

/** One call to `navigator.locks.request`, as recorded by the fake. */
export interface LockRequestRecord {
  /** The name that was requested. */
  readonly name: string;
  /**
   * The options that were passed, exactly as they were. `{}` if the call had no
   * options.
   */
  readonly options: LockOptions;
}

/** Returned by {@link installWebLocks}. */
export interface WebLocksController {
  /** The locks that are held right now, oldest first. */
  readonly held: readonly LockInfo[];
  /** The requests that are waiting for a lock, oldest first. */
  readonly pending: readonly LockInfo[];
  /** Every call to `navigator.locks.request` since the fake was installed. */
  readonly requests: readonly LockRequestRecord[];
  /**
   * Holds a lock that no code under test owns, as another tab would. It
   * follows the same rules as a real request: it waits behind earlier
   * requests, and is granted when it is its turn.
   *
   * @param name - The name of the lock.
   * @param mode - `"exclusive"` or `"shared"`. Default is `"exclusive"`.
   * @returns A handle to wait until the lock is granted and to release it.
   */
  hold(
    name: string,
    mode?: LockMode
  ): { granted: Promise<void>; release(): void };
  /**
   * Releases every lock that `hold` took for this name, as when the tab that
   * owned them closes. A lock that is only waiting is withdrawn.
   *
   * @param name - The name of the lock. Without it, every held lock goes.
   */
  releaseAll(name?: string): void;
  /**
   * Makes a later call to `request` reject with the given error instead of
   * doing anything. Each call to `failNext` covers one call, in order.
   *
   * @param error - What to reject with. Default is a plain `Error`.
   */
  failNext(error?: unknown): void;
  /**
   * Puts back the lock manager that was there before the fake was installed,
   * or removes it if there was none. Locks that are held or waiting are
   * dropped without running anything. Calling it more than once does nothing.
   */
  restore(): void;
}

/** A request that is queued or granted, with what is needed to settle it. */
interface Entry {
  /** The lock's name. */
  name: string;
  /** Whether it is exclusive or shared. */
  mode: LockMode;
  /** Grants the request: runs its callback and settles it. */
  grant: () => void;
  /** Rejects the request, whether it waits or is already granted. */
  abort: (reason: unknown) => void;
  /** Lets the lock go, when it is a `hold`. */
  release: () => void;
  /** Whether it was taken by `hold`, not by `request`. */
  external: boolean;
}

/**
 * Builds the `AbortError` that `request` rejects with when it is aborted
 * without a reason.
 *
 * @returns An `AbortError` `DOMException`.
 */
const abortError = () =>
  new DOMException("The request was aborted.", "AbortError");

/**
 * Replaces `navigator.locks` with an in-memory lock manager that you control.
 *
 * jsdom has no Web Locks API, so components and hooks that use it can't be
 * tested without one. The fake follows the specification where code can tell:
 *
 * - Requests for a name are granted in the order they were made. A shared
 *   request runs together with other shared holders, but waits behind an
 *   earlier request that is still waiting. An exclusive request needs the name
 *   to be free.
 * - The callback runs after the grant, asynchronously, and the lock is held
 *   until the promise it returns settles. `request` settles with whatever the
 *   callback returns, or rejects with whatever it throws.
 * - `ifAvailable` calls the callback with `null` right away if the lock can't
 *   be granted at once. `steal` releases every holder of the name, rejecting
 *   their `request` promises with an `AbortError`, and takes the lock first.
 *   `signal` aborts a request that is waiting, and rejects with its reason. As
 *   in browsers, `ifAvailable` and `steal` can't be combined with each other
 *   or with `signal`, and `steal` needs `exclusive` mode.
 * - `query()` returns a snapshot of the held and pending locks.
 *
 * Because everything is asynchronous, as in a browser, wait for the microtask
 * queue after an action, for example with `await act(async () => {})`, or with
 * fake timers `await vi.advanceTimersByTimeAsync(0)`. The fake doesn't depend
 * on any test runner.
 *
 * It needs a `navigator`, so use a DOM test environment such as jsdom, or Node
 * 21 or later. Call {@link WebLocksController.restore | restore} when the test
 * ends, such as in `afterEach`, so the fake doesn't leak into other tests.
 *
 * @returns A controller to inspect the locks, hold a lock as another tab and
 * restore the original.
 *
 * @example
 * ```tsx
 * import { act, render, screen } from "@testing-library/react";
 * import { installWebLocks, type WebLocksController } from "@altalyst/hookify/testing";
 *
 * let locks: WebLocksController;
 * beforeEach(() => {
 *   locks = installWebLocks();
 * });
 * afterEach(() => locks.restore());
 *
 * it("waits while another tab holds the lock", async () => {
 *   const otherTab = locks.hold("sync");
 *   render(<SyncButton />);
 *
 *   await act(async () => {});
 *   expect(screen.getByText("Waiting for another tab")).toBeInTheDocument();
 *
 *   await act(async () => {
 *     otherTab.release();
 *   });
 *   expect(screen.getByText("Syncing")).toBeInTheDocument();
 * });
 * ```
 *
 * @see {@link https://developer.mozilla.org/docs/Web/API/Web_Locks_API | Web Locks API on MDN}
 */
export const installWebLocks = (): WebLocksController => {
  if (typeof navigator === "undefined") {
    throw new Error(
      "installWebLocks needs a navigator. Use a DOM test environment such as jsdom, or Node 21 or later."
    );
  }

  /** The locks that are held, oldest first. */
  const held: Entry[] = [];
  /** The requests that wait, oldest first. */
  const queue: Entry[] = [];
  /** Every call to `request`. */
  const requests: LockRequestRecord[] = [];
  /** What later calls to `request` are told to reject with. */
  const failures: unknown[] = [];
  /** Whether the fake has been restored. */
  let restored = false;

  /**
   * Whether a request could be granted now, ahead of everything that waits.
   *
   * @param name - The lock's name.
   * @param mode - The requested mode.
   * @returns `true` if no one holds the name in a conflicting way.
   */
  const available = (name: string, mode: LockMode) => {
    const holders = held.filter((entry) => entry.name === name);
    return (
      holders.length === 0 ||
      (mode === "shared" && holders.every((entry) => entry.mode === "shared"))
    );
  };

  /**
   * Grants the requests that can run now, in order. A request that has to wait
   * blocks every later request for the same name, so grants stay in order.
   */
  const pump = () => {
    if (restored) return;
    const blocked = new Set<string>();
    for (const entry of [...queue]) {
      if (!blocked.has(entry.name) && available(entry.name, entry.mode)) {
        queue.splice(queue.indexOf(entry), 1);
        entry.grant();
      } else {
        blocked.add(entry.name);
      }
    }
  };

  /**
   * Lets a held lock go and grants whatever can run now.
   *
   * @param entry - The lock to let go.
   */
  const unhold = (entry: Entry) => {
    const index = held.indexOf(entry);
    if (index !== -1) held.splice(index, 1);
    pump();
  };

  /**
   * Takes a lock that no code under test owns.
   *
   * @param name - The lock's name.
   * @param mode - Its mode.
   * @returns A handle to wait for the grant and to release it.
   */
  const hold: WebLocksController["hold"] = (name, mode = "exclusive") => {
    let onGranted!: () => void;
    const granted = new Promise<void>((resolve) => {
      onGranted = resolve;
    });

    const entry: Entry = {
      name,
      mode,
      external: true,
      grant: () => {
        held.push(entry);
        onGranted();
      },
      abort: () => {},
      release: () => {
        const waiting = queue.indexOf(entry);
        if (waiting !== -1) queue.splice(waiting, 1);
        unhold(entry);
      },
    };
    queue.push(entry);
    pump();

    return { granted, release: () => entry.release() };
  };

  /**
   * The implementation of `navigator.locks.request`.
   *
   * @param name - The lock's name.
   * @param optionsOrCallback - The options, or the callback when there are none.
   * @param maybeCallback - The callback, when there are options.
   * @returns A promise that settles with the callback's result.
   */
  const request = (
    name: string,
    optionsOrCallback: LockOptions | LockGrantedCallback<unknown>,
    maybeCallback?: LockGrantedCallback<unknown>
  ): Promise<unknown> => {
    const options =
      typeof optionsOrCallback === "function" ? {} : optionsOrCallback;
    const callback =
      typeof optionsOrCallback === "function"
        ? optionsOrCallback
        : (maybeCallback as LockGrantedCallback<unknown>);
    requests.push({ name, options });

    if (failures.length > 0) return Promise.reject(failures.shift());

    const mode = options.mode ?? "exclusive";
    const { ifAvailable, steal, signal } = options;

    if (steal && ifAvailable) {
      return Promise.reject(
        new DOMException(
          "ifAvailable and steal are mutually exclusive",
          "NotSupportedError"
        )
      );
    }
    if (steal && mode !== "exclusive") {
      return Promise.reject(
        new DOMException(
          "The steal option may only be used with exclusive locks",
          "NotSupportedError"
        )
      );
    }
    if (signal && (steal || ifAvailable)) {
      return Promise.reject(
        new DOMException(
          "The signal option cannot be used with ifAvailable or steal",
          "NotSupportedError"
        )
      );
    }
    if (name.startsWith("-")) {
      return Promise.reject(
        new DOMException(
          "Names starting with '-' are reserved",
          "NotSupportedError"
        )
      );
    }
    if (signal?.aborted) {
      return Promise.reject(signal.reason ?? abortError());
    }

    return new Promise((resolve, reject) => {
      /** Whether the request's promise has been settled. */
      let settled = false;
      /**
       * Settles the request's promise once.
       *
       * @param action - Resolves or rejects it.
       */
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        action();
      };

      const entry: Entry = {
        name,
        mode,
        external: false,
        // Runs the callback with the lock, and lets the lock go when it is done.
        grant: () => {
          held.push(entry);
          Promise.resolve()
            .then(() => callback({ name, mode } as Lock))
            .then(
              (value) => finish(() => resolve(value)),
              (error) => finish(() => reject(error))
            )
            .finally(() => unhold(entry));
        },
        abort: (reason) => finish(() => reject(reason)),
        release: () => unhold(entry),
      };

      if (steal) {
        for (const holder of held.filter((item) => item.name === name)) {
          holder.abort(abortError());
          held.splice(held.indexOf(holder), 1);
        }
        queue.unshift(entry);
        pump();
      } else if (
        available(name, mode) &&
        !queue.some((item) => item.name === name)
      ) {
        entry.grant();
      } else if (ifAvailable) {
        Promise.resolve()
          .then(() => callback(null))
          .then(resolve, reject);
      } else {
        queue.push(entry);
        signal?.addEventListener(
          "abort",
          () => {
            const index = queue.indexOf(entry);
            if (index === -1) return;
            queue.splice(index, 1);
            finish(() => reject(signal.reason ?? abortError()));
            pump();
          },
          { once: true }
        );
      }
    });
  };

  const locks = {
    request,
    query: async () => ({
      held: held.map(({ name, mode }) => ({ name, mode })),
      pending: queue.map(({ name, mode }) => ({ name, mode })),
    }),
  };

  const restoreProperty = replaceProperty(navigator, "locks", { value: locks });

  return {
    get held() {
      return held.map(({ name, mode }) => ({ name, mode }));
    },
    get pending() {
      return queue.map(({ name, mode }) => ({ name, mode }));
    },
    requests,
    hold,
    releaseAll(name) {
      const matches = (entry: Entry) =>
        entry.external && (name === undefined || entry.name === name);

      // Withdraw the waiting ones first, so that releasing a held lock can't
      // grant one of them on the way.
      for (const entry of queue.filter(matches)) entry.release();
      for (const entry of held.filter(matches)) entry.release();
    },
    failNext(error = new Error("Lock request failed.")) {
      failures.push(error);
    },
    restore() {
      restored = true;
      held.length = 0;
      queue.length = 0;
      restoreProperty();
    },
  };
};
