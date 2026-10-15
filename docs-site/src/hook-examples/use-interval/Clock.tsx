import { useInterval } from "@altalyst/hookify";
import { useState } from "react";

export const Clock = () => {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [delay, setDelay] = useState(1000);

  useInterval(() => setSeconds((s) => s + 1), running ? delay : null);

  return (
    <div>
      <h2>Counter (pause and delay)</h2>
      <p>Seconds: {seconds}</p>
      <button onClick={() => setRunning((r) => !r)}>
        {running ? "Pause" : "Resume"}
      </button>{" "}
      <button onClick={() => setSeconds(0)}>Reset</button>
      <p>
        <label>
          Delay: {delay}ms{" "}
          <input
            type="range"
            min={100}
            max={2000}
            step={100}
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
          />
        </label>
      </p>
    </div>
  );
};
