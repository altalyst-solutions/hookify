import { useInterval } from "@altalyst/hookify";
import { useState } from "react";

// `remaining` and `pending` are not reactive, so poll them to keep the UI fresh.
export const TokenMeter = ({
  limited,
  limit,
}: {
  limited: { remaining: () => number; pending: () => number };
  limit: number;
}) => {
  const [, setTick] = useState(0);
  useInterval(() => setTick((tick) => tick + 1), 100);

  const remaining = limited.remaining();
  return (
    <p>
      Tokens: {"●".repeat(remaining)}
      {"○".repeat(Math.max(0, limit - remaining))} ({remaining}/{limit}),
      queued: {limited.pending()}
    </p>
  );
};
