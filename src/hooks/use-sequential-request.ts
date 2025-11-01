import { useCallback, useEffect, useRef } from "react";

const useLatest = <T>(value: T) => {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
};

const buildCancelableFetch = <T>(
  requestFn: (signal: AbortSignal) => Promise<T>
) => {
  const abortController = new AbortController();
  return {
    run: () =>
      new Promise<T>((resolve, reject) => {
        requestFn(abortController.signal)
          .then(resolve)
          .catch((error) => {
            if (abortController.signal.aborted) {
              reject(new Error("CanceledError"));
            } else {
              reject(error);
            }
          });
      }),
    cancel: () => abortController.abort(),
  };
};

export const useSequentialRequest = <T>(
  requestFn: (signal: AbortSignal) => Promise<T>
) => {
  const requestFnRef = useLatest(requestFn);
  const currentRequest = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    return () => {
      if (currentRequest.current) {
        currentRequest.current.cancel();
      }
    };
  }, []);

  return useCallback(async () => {
    if (currentRequest.current) {
      currentRequest.current.cancel();
    }

    const { run, cancel } = buildCancelableFetch(requestFnRef.current);
    currentRequest.current = { cancel };

    try {
      return await run();
    } finally {
      if (currentRequest.current?.cancel === cancel) {
        currentRequest.current = null;
      }
    }
  }, [requestFnRef]);
};
