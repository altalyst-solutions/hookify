import { replaceProperty } from "./replace-global";

/** Options for {@link installClipboard}. */
export interface ClipboardOptions {
  /** The text on the clipboard to start with. Default is `""`. */
  text?: string;
}

/**
 * A `readText` or `writeText` call that is waiting because of
 * {@link ClipboardController.deferNext | deferNext}.
 */
export interface PendingClipboardCall {
  /** Which method was called. */
  readonly type: "read" | "write";
  /** The text being written. Empty for a read. */
  readonly text: string;
  /** Whether the call has been settled. */
  readonly settled: boolean;
  /**
   * Lets the call succeed. A write then replaces the clipboard text and is
   * recorded in `writes`, and a read resolves with the text at that moment.
   * Does nothing if the call was already settled.
   */
  resolve(): void;
  /**
   * Makes the call reject.
   *
   * @param error - What to reject with. Default is a `NotAllowedError`
   * `DOMException`.
   */
  reject(error?: unknown): void;
}

/** Returned by {@link installClipboard}. */
export interface ClipboardController {
  /** The text on the clipboard right now. */
  readonly text: string;
  /** Every text that was written successfully, oldest first. */
  readonly writes: readonly string[];
  /** How many times `readText` was called, however it ended. */
  readonly reads: number;
  /** The calls that are waiting because of `deferNext`, oldest first. */
  readonly pending: readonly PendingClipboardCall[];
  /**
   * Sets whether the page may use the clipboard. While it is `"denied"`,
   * `readText` and `writeText` reject with a `NotAllowedError`
   * `DOMException`, as they do when the user or the browser refuses.
   * Default is `"granted"`.
   *
   * @param state - The new state.
   */
  setPermission(state: "granted" | "denied"): void;
  /**
   * Makes a later call reject. Each call to `failNext` covers one call to
   * `readText` or `writeText`, in order, so calling it twice fails the next
   * two. A failed write leaves the clipboard text and `writes` unchanged.
   *
   * @param error - What to reject with. It can be anything, such as a string,
   * to test code that doesn't get an `Error`. Default is a plain `Error`.
   */
  failNext(error?: unknown): void;
  /**
   * Makes a later call stay pending until you settle it through
   * {@link ClipboardController.pending | pending}. Each call to `deferNext`
   * covers one call, in order, and it can be mixed with `failNext`. Use it to
   * test what happens while a copy is in flight. Pending calls are rejected
   * with an `AbortError` when the fake is restored.
   */
  deferNext(): void;
  /**
   * Puts back the clipboard that was there before the fake was installed, or
   * removes it if there was none. Calling it more than once does nothing.
   */
  restore(): void;
}

/** What `failNext` and `deferNext` queue up for a later call. */
type Instruction = { fail: unknown } | "defer";

/**
 * Builds the error browsers reject with when clipboard access is refused.
 *
 * @returns A `NotAllowedError` `DOMException`.
 */
const notAllowed = () =>
  new DOMException("Clipboard access was denied.", "NotAllowedError");

/**
 * Replaces `navigator.clipboard` with a fake that you control.
 *
 * jsdom has no Clipboard API, so components and hooks that copy or paste can't
 * be tested without one. The fake keeps its text in memory and records every
 * successful write. It can refuse access with
 * {@link ClipboardController.setPermission | setPermission}, fail a call with
 * {@link ClipboardController.failNext | failNext}, and hold a call in flight
 * with {@link ClipboardController.deferNext | deferNext}. It doesn't depend on
 * any test runner.
 *
 * It needs a `navigator`, which browsers, jsdom and Node 21 or later have. Call
 * {@link ClipboardController.restore | restore} when the test ends, such as in
 * `afterEach`, so the fake doesn't leak into other tests. To test code that
 * runs where there is no clipboard, don't install the fake.
 *
 * @param options - See {@link ClipboardOptions}.
 * @returns A controller to inspect the clipboard, change its behavior and
 * restore the original.
 *
 * @example
 * ```tsx
 * import { render, screen } from "@testing-library/react";
 * import userEvent from "@testing-library/user-event";
 * import { installClipboard, type ClipboardController } from "@altalyst/hookify/testing";
 *
 * let clipboard: ClipboardController;
 * beforeEach(() => {
 *   clipboard = installClipboard();
 * });
 * afterEach(() => clipboard.restore());
 *
 * it("copies the invite link", async () => {
 *   render(<InviteLink url="https://example.com/join" />);
 *
 *   await userEvent.click(screen.getByRole("button", { name: "Copy" }));
 *
 *   expect(clipboard.text).toBe("https://example.com/join");
 * });
 *
 * it("shows an error when copying is refused", async () => {
 *   clipboard.setPermission("denied");
 *   render(<InviteLink url="https://example.com/join" />);
 *
 *   await userEvent.click(screen.getByRole("button", { name: "Copy" }));
 *
 *   expect(screen.getByText("Couldn't copy")).toBeInTheDocument();
 * });
 * ```
 *
 * @see {@link https://developer.mozilla.org/docs/Web/API/Clipboard | Clipboard on MDN}
 */
export const installClipboard = (
  options: ClipboardOptions = {}
): ClipboardController => {
  if (typeof navigator === "undefined") {
    throw new Error(
      "installClipboard needs a navigator. Use a DOM test environment such as jsdom, or Node 21 or later."
    );
  }

  /** The text on the clipboard. */
  let text = options.text ?? "";
  /** Whether the page may use the clipboard. */
  let permission: "granted" | "denied" = "granted";
  /** Every text that was written successfully. */
  const writes: string[] = [];
  /** How many times `readText` was called. */
  let reads = 0;
  /** What later calls are told to do, oldest first. */
  const instructions: Instruction[] = [];
  /** The calls that are held in flight. */
  const pending: PendingClipboardCall[] = [];

  /**
   * Runs one call to `readText` or `writeText`.
   *
   * @param type - Which method was called.
   * @param value - The text being written, or `""` for a read.
   * @returns A promise that settles as the fake has been told to.
   */
  const run = (type: "read" | "write", value: string): Promise<string> => {
    if (type === "read") reads++;

    const instruction = instructions.shift();
    if (instruction && instruction !== "defer") {
      return Promise.reject(instruction.fail);
    }
    if (permission === "denied") return Promise.reject(notAllowed());

    /** Does what a successful call does, and returns what it resolves with. */
    const succeed = () => {
      if (type === "write") {
        text = value;
        writes.push(value);
        return "";
      }
      return text;
    };

    if (instruction !== "defer") return Promise.resolve(succeed());

    return new Promise<string>((resolve, reject) => {
      /** Whether this call has been settled. */
      let settled = false;
      const call = {
        type,
        text: value,
        get settled() {
          return settled;
        },
        resolve() {
          if (settled) return;
          settled = true;
          resolve(succeed());
        },
        reject(error?: unknown) {
          if (settled) return;
          settled = true;
          reject(error ?? notAllowed());
        },
      };
      pending.push(call);
    });
  };

  const clipboard = {
    writeText: (value: string) => run("write", String(value)).then(() => {}),
    readText: () => run("read", ""),
  };

  const restoreProperty = replaceProperty(navigator, "clipboard", {
    value: clipboard,
  });

  return {
    get text() {
      return text;
    },
    writes,
    get reads() {
      return reads;
    },
    get pending() {
      return pending;
    },
    setPermission(state) {
      permission = state;
    },
    failNext(error = new Error("Clipboard call failed.")) {
      instructions.push({ fail: error });
    },
    deferNext() {
      instructions.push("defer");
    },
    restore() {
      for (const call of pending) {
        call.reject(new DOMException("The fake was restored.", "AbortError"));
      }
      restoreProperty();
    },
  };
};
