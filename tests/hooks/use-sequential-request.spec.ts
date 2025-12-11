import { useSequentialRequest } from "@/hooks";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock request function
const mockRequest = vi.fn();

describe("useSequentialRequest", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should call the provided request function", async () => {
    mockRequest.mockResolvedValue("response");

    const { result } = renderHook(() =>
      useSequentialRequest((signal) => mockRequest(signal))
    );

    await act(async () => {
      const response = await result.current();
      expect(response).toBe("response");
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("should cancel the previous request if a new request is made", async () => {
    mockRequest
      .mockImplementationOnce(
        (signal: AbortSignal) =>
          new Promise((_, reject) => {
            signal.addEventListener("abort", () =>
              reject(new Error("CanceledError"))
            );
          })
      )
      .mockResolvedValueOnce("second response");

    const { result } = renderHook(() =>
      useSequentialRequest((signal) => mockRequest(signal))
    );

    // Start first request
    const firstPromise = result.current();

    // Start second request immediately (should cancel first)
    const secondPromise = result.current();

    // Catch first promise to prevent unhandled rejection
    firstPromise.catch(() => {});

    // Verify first request was canceled
    await expect(firstPromise).rejects.toThrow("CanceledError");

    // Verify second request succeeded
    await expect(secondPromise).resolves.toBe("second response");

    // Both requests should have been called
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it("should clean up on component unmount", () => {
    const abortSpy = vi.fn();
    const mockAbortController = {
      abort: abortSpy,
      signal: {} as AbortSignal,
    };

    vi.spyOn(global, "AbortController").mockImplementation(
      () => mockAbortController
    );

    const { result, unmount } = renderHook(() =>
      useSequentialRequest((signal) => mockRequest(signal))
    );

    act(() => {
      result.current();
    });

    unmount();

    expect(abortSpy).toHaveBeenCalledTimes(1);
  });

  it("should handle request errors gracefully", async () => {
    mockRequest.mockRejectedValueOnce(new Error("Request failed"));

    const { result } = renderHook(() =>
      useSequentialRequest((signal) => mockRequest(signal))
    );

    await act(async () => {
      await expect(result.current()).rejects.toThrowError("Request failed");
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("should not cancel a completed request if no new request is made", async () => {
    mockRequest.mockResolvedValueOnce("response");

    const { result } = renderHook(() =>
      useSequentialRequest((signal) => mockRequest(signal))
    );

    await act(async () => {
      const response = await result.current();
      expect(response).toBe("response");
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});
