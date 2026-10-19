import { useCallback, useEffect, useRef, useState } from "react";

import { useLatest } from "./use-latest";

/** Options for {@link useClipboard}. */
export interface UseClipboardOptions {
  /**
   * How long, in milliseconds, `copied` stays `true` after a successful copy.
   * Pass `null` to keep it `true` until `reset` is called or the next copy.
   * Default is `2000`.
   */
  timeout?: number | null;
  /** Called with the copied text after a successful copy. */
  onCopy?: (text: string) => void;
  /** Called with the error when a copy fails. */
  onError?: (error: Error) => void;
}

/** Value returned by {@link useClipboard}. */
export interface UseClipboardReturn {
  /** Copies `text` to the clipboard. Resolves `true` on success and never rejects. */
  copy: (text: string) => Promise<boolean>;
  /** `true` after a successful copy, until `timeout` elapses or `reset` is called. */
  copied: boolean;
  /** The error from the last failed copy, or `null`. Cleared by the next copy or `reset`. */
  error: Error | null;
  /** Clears `copied` and `error` and cancels any pending timeout. */
  reset: () => void;
}

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));

/**
 * Copies text to the clipboard with the async Clipboard API and exposes a
 * temporary `copied` flag, handy for "Copied!" feedback.
 *
 * `copy` never rejects: it resolves `true` on success and `false` on failure,
 * and stores the failure in `error`. Failure covers an unavailable Clipboard
 * API (unsupported browser, insecure context, or server rendering) and a
 * rejected write (for example a denied permission). A newer `copy` call
 * supersedes an older one that is still pending. The timeout is cleared on
 * unmount, and no state is updated after unmount.
 *
 * The Clipboard API requires a secure context (HTTPS or localhost), and most
 * browsers only allow writes from a user gesture such as a click.
 *
 * @param options - Optional {@link UseClipboardOptions | behavior} settings.
 * @returns The `copy` function, the `copied` and `error` state, and `reset`.
 *
 * @example
 * ```tsx
 * const { copy, copied } = useClipboard();
 *
 * return (
 *   <button onClick={() => copy("npm i @altalyst/hookify")}>
 *     {copied ? "Copied!" : "Copy"}
 *   </button>
 * );
 * ```
 *
 * @example
 * ```tsx
 * // Custom timeout and callbacks
 * const { copy, error } = useClipboard({
 *   timeout: 1000,
 *   onCopy: (text) => analytics.track("copy", { length: text.length }),
 *   onError: (err) => toast.error(err.message),
 * });
 * ```
 *
 * For a live, editable example, see the [useClipboard docs page](https://altalyst-solutions.github.io/hookify/hooks/use-clipboard).
 */
export const useClipboard = (
  options?: UseClipboardOptions
): UseClipboardReturn => {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const optionsRef = useLatest(options);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callIdRef = useRef(0);
  const mountedRef = useRef(false);

  const clearTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  const reset = useCallback(() => {
    callIdRef.current++;
    clearTimer();
    setCopied(false);
    setError(null);
  }, [clearTimer]);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const id = ++callIdRef.current;
      clearTimer();

      try {
        if (typeof navigator === "undefined" || !navigator.clipboard) {
          throw new Error("Clipboard API is not available");
        }
        await navigator.clipboard.writeText(text);
      } catch (err) {
        const failure = toError(err);
        if (mountedRef.current && id === callIdRef.current) {
          setCopied(false);
          setError(failure);
        }
        optionsRef.current?.onError?.(failure);
        return false;
      }

      if (mountedRef.current && id === callIdRef.current) {
        setError(null);
        setCopied(true);
        const timeout =
          optionsRef.current?.timeout === undefined
            ? 2000
            : optionsRef.current.timeout;
        if (timeout !== null) {
          timerRef.current = setTimeout(() => {
            timerRef.current = undefined;
            setCopied(false);
          }, timeout);
        }
      }
      optionsRef.current?.onCopy?.(text);
      return true;
    },
    [clearTimer, optionsRef]
  );

  return { copy, copied, error, reset };
};
