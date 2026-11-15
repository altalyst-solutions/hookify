import { useCallback, useEffect, useState } from "react";

import { useLatest } from "./use-latest";

/** Options for {@link useCooldown}. */
export interface UseCooldownOptions {
  /** Begin the countdown on mount instead of waiting for `start`. Default is `false`. */
  autoStart?: boolean;
  /** Called when a countdown reaches `0` on its own. Not called by `reset`. */
  onComplete?: () => void;
}

/** Value returned by {@link useCooldown}. */
export interface UseCooldownReturn {
  /** Whole seconds left. `0` when idle. */
  remaining: number;
  /** `true` while a countdown is running (`remaining > 0`). */
  isActive: boolean;
  /**
   * Begin a fresh countdown from `seconds`, restarting it if one is already
   * running. Pass a number to override the hook's `seconds` for this run only.
   */
  start: (seconds?: number) => void;
  /** Stop the countdown and set `remaining` back to `0`, without `onComplete`. */
  reset: () => void;
}

// Invalid input (NaN, negative, Infinity) is treated as "no cooldown".
const toSeconds = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.ceil(value)) : 0;

/**
 * A one-second countdown for actions that must not be repeated straight away,
 * such as "Resend email" or "Request a new code" buttons.
 *
 * The countdown is idle (`remaining` is `0`) until you call `start`, unless
 * `autoStart` is set. Calling `start` again restarts it from the full
 * duration. `seconds` is rounded up to a whole number; invalid or negative
 * values mean no cooldown. Changing `seconds` while a countdown runs does not
 * affect it; the new value is used by the next `start`.
 *
 * Each tick is a timer re-armed every second, so the pause is never shorter
 * than a second but browsers may delay it in background tabs. The timer is
 * cleared on unmount, and `onComplete` is never called after unmount.
 *
 * @param seconds - The default cooldown length in seconds.
 * @param options - Optional {@link UseCooldownOptions | behavior} flags.
 * @returns The {@link UseCooldownReturn | countdown state and controls}.
 *
 * @example
 * ```tsx
 * const { remaining, isActive, start } = useCooldown(30);
 *
 * const resend = async () => {
 *   await sendVerificationEmail();
 *   start();
 * };
 *
 * <button onClick={resend} disabled={isActive}>
 *   {isActive ? `Resend in ${remaining}s` : "Resend email"}
 * </button>;
 * ```
 *
 * @example
 * ```ts
 * // Honor a server-provided wait time and react when it ends
 * const { start } = useCooldown(60, { onComplete: () => setCanRetry(true) });
 * start(retryAfterSeconds);
 * ```
 *
 * For a live, editable example, see the [useCooldown docs page](https://altalyst-solutions.github.io/hookify/hooks/use-cooldown).
 */
export const useCooldown = (
  seconds: number,
  options?: UseCooldownOptions
): UseCooldownReturn => {
  // A fresh object per start/tick so restarting at the same value re-arms the timer.
  const [state, setState] = useState(() => ({
    remaining: options?.autoStart ? toSeconds(seconds) : 0,
  }));
  const secondsRef = useLatest(seconds);
  const onCompleteRef = useLatest(options?.onComplete);
  const { remaining } = state;

  useEffect(() => {
    if (remaining <= 0) return;

    const id = setTimeout(() => {
      setState({ remaining: remaining - 1 });
      if (remaining === 1) onCompleteRef.current?.();
    }, 1000);
    return () => clearTimeout(id);
  }, [state, remaining, onCompleteRef]);

  const start = useCallback(
    (override?: number) =>
      setState({ remaining: toSeconds(override ?? secondsRef.current) }),
    [secondsRef]
  );

  const reset = useCallback(() => setState({ remaining: 0 }), []);

  return { remaining, isActive: remaining > 0, start, reset };
};
