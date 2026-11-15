import { useCallback, useEffect, useRef } from "react";

import { useLatest } from "./use-latest";

/**
 * Returns whether `error` is an abort error, such as the one a
 * `useSequentialRequest` call rejects with when a newer call or an unmount
 * cancels it, or the one `fetch` throws when its signal is aborted.
 *
 * It checks the error's `name`, so it recognizes the standard `DOMException`
 * as well as libraries that throw their own `Error` named `"AbortError"`.
 *
 * @param error - The value caught from a rejected promise.
 * @returns `true` if `error` is an abort error.
 *
 * @example
 * ```ts
 * try {
 *   setResults(await search());
 * } catch (error) {
 *   if (!isAbortError(error)) console.error("Search failed:", error);
 * }
 * ```
 */
export const isAbortError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { name?: unknown }).name === "AbortError";

/** Creates the reason a superseded or unmounted request is aborted with. */
const createAbortError = (): Error =>
  typeof DOMException === "function"
    ? new DOMException("The request was canceled.", "AbortError")
    : Object.assign(new Error("The request was canceled."), {
        name: "AbortError",
      });

/**
 * Creates a cancelable fetch operation with an AbortController.
 *
 * This helper function wraps a request function with abort capability, allowing
 * the request to be canceled at any time. If the request is aborted, it rejects
 * with an `AbortError` (the same reason the signal is aborted with). Otherwise, it
 * resolves or rejects based on the original request function's behavior.
 *
 * @typeParam T - The type of data expected from the request.
 * @param requestFn - The request function that accepts an AbortSignal.
 * @returns An object containing:
 * - `run`: Function to execute the request.
 * - `cancel`: Function to abort the ongoing request.
 */
const buildCancelableFetch = <T>(
  requestFn: (signal: AbortSignal) => Promise<T>
): { run: () => Promise<T>; cancel: () => void } => {
  const abortController = new AbortController();
  return {
    run: () =>
      new Promise<T>((resolve, reject) => {
        requestFn(abortController.signal)
          .then(resolve)
          .catch((error) => {
            if (abortController.signal.aborted) {
              reject(abortController.signal.reason);
            } else {
              reject(error);
            }
          });
      }),
    cancel: () => abortController.abort(createAbortError()),
  };
};

/**
 * A custom React hook for managing sequential asynchronous requests with automatic cancellation.
 *
 * This hook ensures that only the most recent request is processed by automatically canceling
 * any previous ongoing requests when a new request is initiated. This is particularly useful
 * for handling rapid user interactions (like search inputs or button clicks) where only the
 * latest request's result matters.
 *
 * When a new request is triggered while another is in progress, the previous request is
 * immediately aborted using the AbortSignal API. This prevents race conditions and ensures
 * that stale data doesn't override newer results.
 *
 * The hook also handles cleanup on component unmount, automatically canceling any pending
 * requests to prevent memory leaks and unwanted state updates.
 *
 * @typeParam T - The type of data expected from the request.
 * @param requestFn - The asynchronous request function
 *        that should accept an AbortSignal parameter for cancellation support. This function
 *        should handle the abort signal appropriately (e.g., pass it to fetch API).
 * @returns A callback function that triggers the request. When called,
 *          it cancels any previous ongoing request and starts a new one. The returned promise
 *          resolves with the request result or rejects with an `AbortError` if canceled.
 *          Use `isAbortError` to tell a cancellation from a real failure.
 *
 * @example
 * ```ts
 * const searchUsers = useSequentialRequest(async (signal) => {
 *   const response = await fetch(`/api/users?query=${query}`, { signal });
 *   return response.json();
 * });
 *
 * // In an event handler:
 * const handleSearch = async () => {
 *   try {
 *     const results = await searchUsers();
 *     setResults(results);
 *   } catch (error) {
 *     if (!isAbortError(error)) {
 *       console.error("Search failed:", error);
 *     }
 *   }
 * };
 * ```
 *
 * @example
 * ```ts
 * const submitForm = useSequentialRequest(async (signal) => {
 *   const response = await fetch('/api/submit', {
 *     method: 'POST',
 *     body: JSON.stringify(formData),
 *     signal
 *   });
 *   return response.json();
 * });
 *
 * // Only the last submission will complete
 * await submitForm();
 * ```
 *
 * For a live, editable example, see the [useSequentialRequest docs page](https://altalyst-solutions.github.io/hookify/hooks/use-sequential-request).
 */
export const useSequentialRequest = <T>(
  requestFn: (signal: AbortSignal) => Promise<T>
): (() => Promise<T>) => {
  const requestFnRef = useLatest(requestFn);
  const currentRequest = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    return () => {
      if (currentRequest.current) {
        currentRequest.current.cancel();
      }
    };
  }, []);

  /**
   * Executes the request function, canceling any previous ongoing request.
   *
   * @returns A promise that resolves with the request result or rejects
   *                       with an `AbortError` if the request is canceled.
   */
  return useCallback(async () => {
    if (currentRequest.current) {
      currentRequest.current.cancel();
    }

    const { run, cancel } = buildCancelableFetch(requestFnRef.current);
    currentRequest.current = { cancel };

    try {
      return await run();
    } finally {
      if (currentRequest.current?.cancel === cancel) {
        currentRequest.current = null;
      }
    }
  }, [requestFnRef]);
};
