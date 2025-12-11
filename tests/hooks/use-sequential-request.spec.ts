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
    let firstRequestResolve: (value: string) => void;
    let secondRequestResolve: (value: string) => void;

    // Mock the request function to return a promise that can be manually resolved
    mockRequest
      .mockImplementationOnce((signal: AbortSignal) => {
        return new Promise((resolve, reject) => {
          firstRequestResolve = resolve;
          // Listen for the abort event
          signal.addEventListener("abort", () =>
            reject(new Error("CanceledError"))
          );
        });
      })
      .mockImplementationOnce((_signal: AbortSignal) => {
        return new Promise((resolve) => {
          secondRequestResolve = resolve;
        });
      });

    const { result } = renderHook(() =>
      useSequentialRequest((signal) => mockRequest(signal))
    );

    // Trigger the first request
    const promise1 = result.current();

    // Allow some time for the first request to start
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Trigger the second request before the first one finishes
    // This should cancel the first request
    const promise2 = result.current();

    // Catch the first request rejection to prevent unhandled promise rejection
    promise1.catch(() => {});

    // Ensure the first request is canceled
    await expect(promise1).rejects.toThrow("CanceledError");

    // Resolve the second request
    await act(async () => {
      secondRequestResolve!("response");
    });

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
