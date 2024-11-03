import { useEffect, useState } from "react";

/**
 * Options for configuring the API request.
 * @interface UseApiOptions
 */
interface UseApiOptions {
  /** The HTTP method to use for the request. Default is `GET`. */
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Headers to include in the request. */
  headers?: HeadersInit;
  /** The body of the request for methods that require it (e.g., `POST`, `PUT`). */
  body?: BodyInit;
}

/**
 * The return type of the useApi hook.
 * @template T
 * @interface UseApiReturn
 */
interface UseApiReturn<T> {
  /** The fetched data, or null if there’s no data yet. */
  data: T | null;
  /** Indicates whether the request is currently being processed. */
  loading: boolean;
  /** Contains any error message if the request fails, or null if no error occurred. */
  error: string | null;
  /** Function to manually refetch the data. */
  refetch: () => Promise<void>;
}

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
 * The response data is automatically parsed as JSON, and any errors encountered
 * during the request process are caught and returned, allowing the consuming
 * component to handle them appropriately.
 *
 * @template T The type of data expected in the response. This helps ensure type safety
 *             when consuming the data in a TypeScript environment.
 * @param {string} url - The endpoint from which to fetch data. This should be a fully
 *                       qualified URL that the application can reach.
 * @param {UseApiOptions} [options] - Options for configuring the request, including
 *                                     HTTP method, headers, and body content.
 * @returns {UseApiReturn<T>} The result of the API request, including:
 * - `data`: The fetched data, or null if there’s no data yet.
 * - `loading`: Indicates whether the request is currently being processed.
 * - `error`: Contains any error message if the request fails, or null if no error occurred.
 * - `refetch`: Function to manually refetch the data, useful for refreshing data in UI.
 *
 * @example
 * const { data, loading, error, refetch } = useApi<MyDataType>('https://api.example.com/data');
 */
export const useApi = <T = unknown>(
  url: string,
  options?: UseApiOptions
): UseApiReturn<T> => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchApi = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        method: options?.method || "GET",
        headers: options?.headers,
        body: options?.body,
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const result: T = await response.json();
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApi();
  }, [url, options?.method, options?.headers, options?.body]);

  return { data, loading, error, refetch: fetchApi };
};
