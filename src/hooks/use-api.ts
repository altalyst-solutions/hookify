import { useEffect, useState } from "react";

interface UseApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: HeadersInit;
  body?: BodyInit;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

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
