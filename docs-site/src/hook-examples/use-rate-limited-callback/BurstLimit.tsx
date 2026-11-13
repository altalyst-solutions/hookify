import { useRateLimitedCallback } from "@altalyst/hookify";
import { useState } from "react";

import { TokenMeter } from "./TokenMeter";

export const BurstLimit = () => {
  const [status, setStatus] = useState("Nothing sent yet");
  const [sent, setSent] = useState(0);

  const send = useRateLimitedCallback(
    () => {
      console.log("Request sent");
      setSent((n) => n + 1);
    },
    {
      limit: 3,
      windowMs: 6000,
      onLimited: () => console.log("Dropped: out of tokens"),
    }
  );

  return (
    <div>
      <h2>Burst limit (3 per 6s, extra calls dropped)</h2>
      <p>
        Click quickly: the first 3 run at once, then one token returns every 2
        seconds.
      </p>
      <button
        onClick={() =>
          setStatus(send() ? "Sent" : "Rate limited, try again shortly")
        }
      >
        Send request
      </button>
      <TokenMeter limited={send} limit={3} />
      <p>
        Requests sent: {sent}. Last click: {status}
      </p>
    </div>
  );
};
