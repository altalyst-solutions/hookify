import { useNow } from "@altalyst/hookify";
import { useRef, useState } from "react";

export const LiveClock = () => {
  const [intervalMs, setIntervalMs] = useState(1000);
  const [pauseWhenHidden, setPauseWhenHidden] = useState(true);
  const renders = useRef(0);
  renders.current += 1;

  const now = useNow({ intervalMs, pauseWhenHidden });

  return (
    <div>
      <h2>Live clock (interval and pause options)</h2>
      <p>
        {new Date(now).toLocaleTimeString()} · renders: {renders.current}
      </p>
      <p>
        <label>
          Interval:{" "}
          <select
            value={intervalMs}
            onChange={(e) => setIntervalMs(Number(e.target.value))}
          >
            <option value={250}>250 ms</option>
            <option value={1000}>1 second</option>
            <option value={5000}>5 seconds</option>
          </select>
        </label>{" "}
        <label>
          <input
            type="checkbox"
            checked={pauseWhenHidden}
            onChange={(e) => setPauseWhenHidden(e.target.checked)}
          />{" "}
          Pause while the tab is hidden
        </label>
      </p>
      <p>
        Switch to another tab and back: with the option on, the clock jumps to
        the current time as soon as you return.
      </p>
    </div>
  );
};
