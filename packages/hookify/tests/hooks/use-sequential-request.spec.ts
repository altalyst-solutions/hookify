import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { isAbortError, useSequentialRequest } from "@/hooks";

// Mock request function
const mockRequest = vi.fn();

describe("useSequentialRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
              reject(new Error("request-specific abort error"))
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
    const firstError = await firstPromise.catch((error: unknown) => error);
    expect(isAbortError(firstError)).toBe(true);
    expect(firstError).toBeInstanceOf(DOMException);
    expect((firstError as DOMException).name).toBe("AbortError");

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

    vi.spyOn(global, "AbortController").mockImplementation(function () {
      return mockAbortController;
    } as unknown as () => AbortController);

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

  it("should abort the signal with the same AbortError it rejects with", async () => {
    let seenSignal: AbortSignal | undefined;
    mockRequest
      .mockImplementationOnce(
        (signal: AbortSignal) =>
          new Promise((_, reject) => {
            seenSignal = signal;
            signal.addEventListener("abort", () => reject(signal.reason));
          })
      )
      .mockResolvedValueOnce("second");

    const { result } = renderHook(() =>
      useSequentialRequest((signal) => mockRequest(signal))
    );

    const first = result.current().catch((error: unknown) => error);
    await result.current();

    expect(await first).toBe(seenSignal?.reason);
  });

  it("should reject an unmounted request with an AbortError", async () => {
    mockRequest.mockImplementationOnce(
      (signal: AbortSignal) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        })
    );

    const { result, unmount } = renderHook(() =>
      useSequentialRequest((signal) => mockRequest(signal))
    );

    const pending = result.current().catch((error: unknown) => error);
    unmount();

    expect(isAbortError(await pending)).toBe(true);
  });
});

describe("isAbortError", () => {
  it("recognizes a DOMException AbortError", () => {
    expect(isAbortError(new DOMException("x", "AbortError"))).toBe(true);
  });

  it("recognizes an Error named AbortError", () => {
    const error = Object.assign(new Error("x"), { name: "AbortError" });
    expect(isAbortError(error)).toBe(true);
  });

  it("rejects other errors and non-objects", () => {
    expect(isAbortError(new Error("CanceledError"))).toBe(false);
    expect(isAbortError(new DOMException("x", "TimeoutError"))).toBe(false);
    expect(isAbortError("AbortError")).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });
});
