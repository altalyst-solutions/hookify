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
    // Create an AbortController to get a valid AbortSignal
    const abortController = new AbortController();

    // Mock the request function to reject on abortion
    mockRequest.mockImplementationOnce((signal: AbortSignal) => {
      return new Promise((resolve, reject) => {
        if (signal.aborted) {
          return reject(new Error("CanceledError"));
        }

        // Listen for the abort event
        signal.addEventListener("abort", () =>
          reject(new Error("CanceledError"))
        );

        // Otherwise, resolve after a delay
        setTimeout(() => resolve("response"), 1000);
      });
    });

    const { result } = renderHook(() =>
      useSequentialRequest((signal) => mockRequest(signal))
    );

    // Trigger the first request
    const promise1 = result.current();

    // Trigger the second request before the first one finishes
    const promise2 = result.current();

    // Allow some time for the first request to start
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Cancel the first request
    abortController.abort();

    // Ensure the first request is canceled
    await expect(promise1).rejects.toThrow("CanceledError");

    // Ensure the second request completes successfully
    await expect(promise2).resolves.toBe("response");

    // Ensure that the mock request was called twice
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
