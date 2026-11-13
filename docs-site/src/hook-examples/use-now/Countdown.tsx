import { useNow } from "@altalyst/hookify";
import { useState } from "react";

const DURATION_MS = 15_000;

export const Countdown = () => {
  const [deadline, setDeadline] = useState(() => Date.now() + DURATION_MS);

  const now = useNow({ intervalMs: 250 });
  const left = Math.max(0, deadline - now);

  return (
    <div>
      <h2>Countdown to a deadline</h2>
      <p>{left > 0 ? `${Math.ceil(left / 1000)}s left` : "Time is up!"}</p>
      <button onClick={() => setDeadline(Date.now() + DURATION_MS)}>
        Restart
      </button>
    </div>
  );
};
