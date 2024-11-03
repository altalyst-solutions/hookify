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
  /** The body of the request for methods that require it (e.g., POST, PUT). */
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
 * @template T
 * @param {string} url - The endpoint from which to fetch data.
 * @param {UseApiOptions} [options] - Options for configuring the request.
 * @returns {UseApiReturn<T>} The result of the API request.
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
