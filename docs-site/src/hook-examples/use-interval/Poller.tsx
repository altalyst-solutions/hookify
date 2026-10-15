import { useInterval } from "@altalyst/hookify";
import { useState } from "react";

export const Poller = () => {
  const [enabled, setEnabled] = useState(false);
  const [polls, setPolls] = useState(0);

  // The latest `polls` is read without restarting the timer.
  useInterval(
    () => {
      console.log(`Poll #${polls + 1}`);
      setPolls(polls + 1);
    },
    enabled ? 2000 : null,
    { immediate: true }
  );

  return (
    <div>
      <h2>Polling (immediate)</h2>
      <p>Polls: {polls} (every 2s, first poll runs right away)</p>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />{" "}
        Polling enabled
      </label>
    </div>
  );
};
