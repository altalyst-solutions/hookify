import { useRateLimitedCallback } from "@altalyst/hookify";
import { useState } from "react";

import { TokenMeter } from "./TokenMeter";

export const EventQueue = () => {
  const [log, setLog] = useState<string[]>([]);
  const [counter, setCounter] = useState(0);

  const track = useRateLimitedCallback(
    (name: string) => {
      console.log(`Delivered ${name}`);
      setLog((entries) => [...entries.slice(-4), name]);
    },
    {
      limit: 2,
      windowMs: 4000,
      overflow: "queue",
      maxQueue: 4,
      onLimited: (name) => console.log(`Dropped ${name}: the queue is full`),
    }
  );

  return (
    <div>
      <h2>Queue (2 per 4s, up to 4 waiting)</h2>
      <p>
        Queued events are delivered in order as tokens refill. Past 4 waiting,
        new events are dropped. Cancel empties the queue.
      </p>
      <button
        onClick={() => {
          const name = `event-${counter + 1}`;
          setCounter((n) => n + 1);
          track(name);
        }}
      >
        Track event
      </button>{" "}
      <button onClick={track.cancel}>Cancel queue</button>
      <TokenMeter limited={track} limit={2} />
      <p>Delivered (latest 5): {log.join(", ") || "nothing yet"}</p>
    </div>
  );
};
