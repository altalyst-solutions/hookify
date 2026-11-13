import { useNow } from "@altalyst/hookify";
import { useState } from "react";

const format = (ms: number) => {
  const total = Math.max(0, ms);
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor(total / 1000) % 60;
  const tenths = Math.floor(total / 100) % 10;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
};

export const Stopwatch = () => {
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [banked, setBanked] = useState(0);

  // `enabled: false` stops the timer, so a paused stopwatch costs nothing.
  const now = useNow({ intervalMs: 100, enabled: running });
  const elapsed = banked + (running ? Math.max(0, now - startedAt) : 0);

  const start = () => {
    setStartedAt(Date.now());
    setRunning(true);
  };
  const pause = () => {
    setBanked(elapsed);
    setRunning(false);
  };
  const reset = () => {
    setBanked(0);
    setRunning(false);
  };

  return (
    <div>
      <h2>Stopwatch (enabled)</h2>
      <p>{format(elapsed)}</p>
      <button onClick={running ? pause : start}>
        {running ? "Pause" : "Start"}
      </button>{" "}
      <button onClick={reset}>Reset</button>
    </div>
  );
};
