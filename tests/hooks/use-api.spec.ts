import { useApi } from "@/hooks";
import { act, renderHook } from "@testing-library/react";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockResponse {
  success: boolean;
}

global.fetch = vi.fn();

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
    expect(result.current.error).toBe("Error: 404");
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
});
