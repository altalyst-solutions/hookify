import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef } from "react";

/**
 * A utility hook that keeps a reference to the latest value without triggering re-renders.
 *
 * This hook ensures that the reference always points to the most current value,
 * which is useful for accessing the latest state or props in callbacks without
 * needing to include them as dependencies.
 *
 * @template T - The type of the value to track.
 * @param {T} value - The value to keep a reference to.
 * @returns {MutableRefObject<T>} A ref object containing the latest value.
 */
const useLatest = <T>(value: T): MutableRefObject<T> => {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
};

/**
 * Creates a cancelable fetch operation with an AbortController.
 *
 * This helper function wraps a request function with abort capability, allowing
 * the request to be canceled at any time. If the request is aborted, it rejects
 * with a "CanceledError". Otherwise, it resolves or rejects based on the original
 * request function's behavior.
 *
 * @template T - The type of data expected from the request.
 * @param {(signal: AbortSignal) => Promise<T>} requestFn - The request function that accepts an AbortSignal.
 * @returns {{ run: () => Promise<T>, cancel: () => void }} An object containing:
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
              reject(new Error("CanceledError"));
            } else {
              reject(error);
            }
          });
      }),
    cancel: () => abortController.abort(),
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
 * @template T - The type of data expected from the request.
 * @param {(signal: AbortSignal) => Promise<T>} requestFn - The asynchronous request function
 *        that should accept an AbortSignal parameter for cancellation support. This function
 *        should handle the abort signal appropriately (e.g., pass it to fetch API).
 * @returns {() => Promise<T>} A callback function that triggers the request. When called,
 *          it cancels any previous ongoing request and starts a new one. The returned promise
 *          resolves with the request result or rejects with "CanceledError" if canceled.
 *
 * @example
 * ```typescript
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
 *     if (error.message !== "CanceledError") {
 *       console.error("Search failed:", error);
 *     }
 *   }
 * };
 * ```
 *
 * @example
 * ```typescript
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
 * For a complete example, see [examples/useSequentialRequest.ts](../../examples/basic/src/components/use-sequential-request.tsx).
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
   * @returns {Promise<T>} A promise that resolves with the request result or rejects
   *                       with "CanceledError" if the request is canceled.
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
