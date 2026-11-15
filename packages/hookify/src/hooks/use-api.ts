import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Options for configuring the API request.
 */
export interface UseApiOptions {
  /** The HTTP method to use for the request. Default is `GET`. */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Headers to include in the request. */
  headers?: HeadersInit;
  /** The body of the request for methods that require it (e.g., `POST`, `PUT`). */
  body?: BodyInit;
}

/**
 * The error `useApi` reports when the server responds with a non-2xx status.
 *
 * It keeps the `status` and the raw `response`, so callers can branch on the
 * status code or read an error body (for example `await error.response.json()`).
 * Network failures and JSON parse errors are reported as the original `Error`.
 *
 * @example
 * ```ts
 * const { error } = useApi<User>("/api/user");
 *
 * if (error instanceof ApiError && error.status === 401) {
 *   redirectToLogin();
 * }
 * ```
 */
export class ApiError extends Error {
  /** The HTTP status code of the response. */
  readonly status: number;
  /** The response that failed. Its body has not been read. */
  readonly response: Response;

  constructor(response: Response) {
    super(`Request failed with status ${response.status}`);
    this.name = "ApiError";
    this.status = response.status;
    this.response = response;
  }
}

/**
 * The return type of the useApi hook.
 * @typeParam T - The type of data expected in the response.
 */
export interface UseApiReturn<T> {
  /** The fetched data, or null if there’s no data yet. */
  data: T | null;
  /** Indicates whether the request is currently being processed. */
  loading: boolean;
  /**
   * The error if the request failed, or null if no error occurred. Non-2xx
   * responses are reported as an {@link ApiError} with the `status` and
   * `response`; other failures (network, JSON parsing) as the thrown `Error`.
   */
  error: Error | null;
  /** Function to manually refetch the data. */
  refetch: () => Promise<void>;
}

/**
 * The outcome of a request, reported as a value instead of a thrown error.
 * @typeParam T - The type of data returned on success.
 */
type RequestResult<T> = { ok: true; data: T } | { ok: false; error: Error };

/** Performs the request and reports the outcome as a value, so it never throws. */
const requestJson = async <T>(
  url: string,
  init: RequestInit
): Promise<RequestResult<T>> => {
  try {
    const response = await fetch(url, init);

    if (!response.ok) {
      throw new ApiError(response);
    }

    // "No Content" responses have no body to parse.
    if (response.status === 204 || response.status === 205) {
      return { ok: true, data: null as T };
    }

    return { ok: true, data: (await response.json()) as T };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
};

/**
 * Custom React hook to perform API requests.
 *
 * This hook simplifies the process of making HTTP requests from a React component,
 * managing the loading state, data, and error handling for the request lifecycle.
 *
 * On initialization, the hook triggers a fetch request to the specified URL
 * and tracks the loading status until the request is complete. It also provides
 * a `refetch` function to allow manual re-execution of the request, useful
 * in scenarios where data may need to be refreshed.
 *
 * The hook can handle different HTTP methods and allows for custom headers
 * and request bodies, making it flexible for various API interactions.
 *
 * Only the latest request can update the state: when the inputs change, `refetch`
 * is called again, or the component unmounts, the request in flight is aborted
 * through an `AbortSignal` and its result is ignored. This prevents a slow,
 * outdated response from overwriting a newer one.
 *
 * The response data is automatically parsed as JSON (`204` and `205` responses
 * resolve to `null`), and any errors encountered
 * during the request process are caught and returned, allowing the consuming
 * component to handle them appropriately.
 *
 * @typeParam T - The type of data expected in the response. This helps ensure type safety
 *                when consuming the data in a TypeScript environment.
 * @param url - The endpoint from which to fetch data. This should be a fully
 *              qualified URL that the application can reach.
 * @param options - Options for configuring the request, including
 *                  HTTP method, headers, and body content.
 * @returns The result of the API request, including:
 * - `data`: The fetched data, or null if there’s no data yet.
 * - `loading`: Indicates whether the request is currently being processed.
 * - `error`: The `Error` if the request failed (an `ApiError` with `status` and `response` for non-2xx responses), or null if no error occurred.
 * - `refetch`: Function to manually refetch the data, useful for refreshing data in UI.
 *
 * @example
 * ```ts
 * const { data, loading, error, refetch } = useApi<MyDataType>('https://api.example.com/data');
 * ```
 */
export const useApi = <T = unknown>(
  url: string,
  options?: UseApiOptions
): UseApiReturn<T> => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const { method, headers, body } = options ?? {};

  /**
   * The headers as a comparable string. Inline `headers` objects get a new
   * identity every render, so comparing them by value keeps `request` (and
   * therefore the fetch) from re-running when nothing actually changed.
   */
  const headersKey = headers
    ? JSON.stringify([...new Headers(headers).entries()])
    : undefined;

  /**
   * Performs the request for the current url and options. Its identity changes
   * only when those inputs change, which is what triggers a new fetch.
   */
  const request = useCallback(
    (signal: AbortSignal) =>
      requestJson<T>(url, {
        signal,
        method: method || "GET",
        headers: headersKey
          ? Object.fromEntries(JSON.parse(headersKey) as [string, string][])
          : undefined,
        body,
      }),
    [url, method, headersKey, body]
  );

  /**
   * Writes a finished request into state. Only ever called from a promise
   * callback, never synchronously inside an effect.
   */
  const applyResult = useCallback((result: RequestResult<T>) => {
    if (result.ok) {
      setData(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  /**
   * Tracks the request the current state belongs to. When the inputs change,
   * the state is reset during render (the documented "adjust state while
   * rendering" pattern) so consumers never see a stale "loaded" frame before
   * the new fetch starts.
   */
  const [currentRequest, setCurrentRequest] = useState(() => request);
  if (currentRequest !== request) {
    setCurrentRequest(() => request);
    setLoading(true);
    setError(null);
  }

  /** The controller of the request in flight, aborted when a newer one starts. */
  const controllerRef = useRef<AbortController | null>(null);

  /** Aborts the request in flight and returns the controller for a new one. */
  const begin = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller;
  }, []);

  /**
   * Applies a finished request, unless it was aborted because a newer request
   * started or the component unmounted.
   */
  const settle = useCallback(
    (controller: AbortController, result: RequestResult<T>) => {
      if (controller.signal.aborted) return;
      controllerRef.current = null;
      applyResult(result);
    },
    [applyResult]
  );

  /**
   * Manually re-runs the request, exposed to consumers as `refetch`.
   * Switches back to the loading state before fetching.
   */
  const fetchApi = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = begin();
    settle(controller, await request(controller.signal));
  }, [begin, request, settle]);

  // Fetch on mount and whenever the request inputs change.
  useEffect(() => {
    const controller = begin();
    request(controller.signal).then((result) => settle(controller, result));
  }, [begin, request, settle]);

  // Abort whatever is still in flight (including a `refetch`) on unmount.
  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    []
  );

  return { data, loading, error, refetch: fetchApi };
};
