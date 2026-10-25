import { useCooldown } from "@altalyst/hookify";
import { useState } from "react";

export const RetryAfter = () => {
  const [attempts, setAttempts] = useState(0);
  const { remaining, isActive, start, reset } = useCooldown(5, {
    autoStart: true,
  });

  // Pretend the server answered "429, retry after N seconds".
  const attempt = () => {
    setAttempts((n) => n + 1);
    start(5 + attempts * 5);
  };

  return (
    <div>
      <h2>Retry after (autoStart, per-run override)</h2>
      <p>Attempts: {attempts}. Each attempt waits 5s longer than the last.</p>
      <button onClick={attempt} disabled={isActive}>
        {isActive ? `Try again in ${remaining}s` : "Try again"}
      </button>{" "}
      <button onClick={reset} disabled={!isActive}>
        Skip wait
      </button>
    </div>
  );
};
