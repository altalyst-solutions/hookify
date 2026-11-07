import { act, renderHook } from "@testing-library/react";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, useApi } from "@/hooks";

interface MockResponse {
  success: boolean;
}

globalThis.fetch = vi.fn();

describe("useApi", () => {
  const mockUrl = "https://api.example.com/data";
  const mockData: MockResponse = { success: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with loading state and no data or error", async () => {
    (fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useApi<MockResponse>(mockUrl));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it("should fetch data successfully and update data state", async () => {
    (fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useApi<MockResponse>(mockUrl));

    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it("should set error state when the fetch fails", async () => {
    (fetch as Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const { result } = renderHook(() => useApi<MockResponse>(mockUrl));

    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.message).toBe(
      "Request failed with status 404"
    );
    expect((result.current.error as ApiError).status).toBe(404);
  });

  it("should expose the failed response on ApiError", async () => {
    const failed = {
      ok: false,
      status: 422,
      json: async () => ({ field: "x" }),
    };
    (fetch as Mock).mockResolvedValueOnce(failed);

    const { result } = renderHook(() => useApi(mockUrl));
    await act(async () => {});

    const error = result.current.error as ApiError;
    expect(error.name).toBe("ApiError");
    expect(error.response).toBe(failed);
    expect(await error.response.json()).toEqual({ field: "x" });
  });

  it("should report network failures as the original Error", async () => {
    const networkError = new TypeError("Failed to fetch");
    (fetch as Mock).mockRejectedValueOnce(networkError);

    const { result } = renderHook(() => useApi(mockUrl));
    await act(async () => {});

    expect(result.current.error).toBe(networkError);
    expect(result.current.loading).toBe(false);
  });

  it("should wrap non-Error rejections in an Error", async () => {
    (fetch as Mock).mockRejectedValueOnce("offline");

    const { result } = renderHook(() => useApi(mockUrl));
    await act(async () => {});

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("offline");
  });

  it("should not refetch when inline headers keep the same values", async () => {
    (fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const { result, rerender } = renderHook(() =>
      useApi<MockResponse>(mockUrl, {
        headers: { Authorization: "Bearer token" },
      })
    );

    await act(async () => {});
    rerender();
    rerender();
    await act(async () => {});

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      mockUrl,
      expect.objectContaining({ headers: { authorization: "Bearer token" } })
    );
    expect(result.current.data).toEqual(mockData);
  });

  it("should refetch when the header values change", async () => {
    (fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const { rerender } = renderHook(
      ({ token }) =>
        useApi<MockResponse>(mockUrl, {
          headers: { Authorization: token },
        }),
      { initialProps: { token: "a" } }
    );

    await act(async () => {});
    rerender({ token: "b" });
    await act(async () => {});

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("should allow refetching data", async () => {
    (fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useApi<MockResponse>(mockUrl));

    await act(async () => {});

    expect(result.current.data).toEqual(mockData);

    // Simulate data update on refetch
    const newMockData: MockResponse = { success: false };
    (fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => newMockData,
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.data).toEqual(newMockData);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should ignore a stale response when the url changes mid-flight", async () => {
    let resolveFirst!: (value: unknown) => void;
    (fetch as Mock)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce({ ok: true, json: async () => ({ url: "b" }) });

    const { result, rerender } = renderHook(
      ({ url }) => useApi<{ url: string }>(url),
      { initialProps: { url: "https://api.example.com/a" } }
    );

    rerender({ url: "https://api.example.com/b" });
    await act(async () => {});

    expect(result.current.data).toEqual({ url: "b" });

    await act(async () => {
      resolveFirst({ ok: true, json: async () => ({ url: "a" }) });
    });

    expect(result.current.data).toEqual({ url: "b" });
    expect(result.current.loading).toBe(false);
  });

  it("should abort the previous request when the url changes", async () => {
    (fetch as Mock).mockResolvedValue({ ok: true, json: async () => mockData });

    const { rerender } = renderHook(({ url }) => useApi(url), {
      initialProps: { url: "https://api.example.com/a" },
    });
    const firstSignal = (fetch as Mock).mock.calls[0][1].signal as AbortSignal;

    rerender({ url: "https://api.example.com/b" });
    await act(async () => {});

    expect(firstSignal.aborted).toBe(true);
  });

  it("should abort the request in flight on unmount", async () => {
    (fetch as Mock).mockReturnValueOnce(new Promise(() => {}));

    const { unmount } = renderHook(() => useApi(mockUrl));
    const signal = (fetch as Mock).mock.calls[0][1].signal as AbortSignal;

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it("should let refetch supersede the request in flight", async () => {
    let resolveFirst!: (value: unknown) => void;
    (fetch as Mock)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce({ ok: true, json: async () => ({ n: 2 }) });

    const { result } = renderHook(() => useApi<{ n: number }>(mockUrl));

    await act(async () => {
      await result.current.refetch();
    });
    await act(async () => {
      resolveFirst({ ok: true, json: async () => ({ n: 1 }) });
    });

    expect(result.current.data).toEqual({ n: 2 });
  });

  it("should resolve a 204 response to null without parsing the body", async () => {
    const json = vi.fn();
    (fetch as Mock).mockResolvedValueOnce({ ok: true, status: 204, json });

    const { result } = renderHook(() =>
      useApi(mockUrl, { method: "PATCH", body: "{}" })
    );
    await act(async () => {});

    expect(json).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      mockUrl,
      expect.objectContaining({ method: "PATCH" })
    );
  });
});
