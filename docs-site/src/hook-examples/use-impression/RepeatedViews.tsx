import { useImpression } from "@altalyst/hookify";
import { useState } from "react";

export const RepeatedViews = () => {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [views, setViews] = useState(0);

  // With `once: false`, the ad counts again each time it leaves the box and
  // then stays in view for the dwell time.
  const ref = useImpression<HTMLDivElement>(() => setViews((n) => n + 1), {
    root,
    once: false,
    threshold: 0.75,
    minDurationMs: 800,
  });

  return (
    <div>
      <h2>Repeated impressions</h2>
      <p>
        Scroll the ad out of the box and back in, and keep it in view for 0.8
        seconds. Views counted: <strong>{views}</strong>.
      </p>
      <div
        ref={setRoot}
        style={{
          height: 160,
          overflowY: "auto",
          border: "1px solid",
          borderRadius: 4,
        }}
      >
        <div style={{ height: 160, padding: 8 }}>Scroll down...</div>
        <div
          ref={ref}
          style={{
            height: 80,
            margin: "0 8px",
            padding: 8,
            borderRadius: 4,
            background: "steelblue",
            color: "white",
          }}
        >
          Ad banner
        </div>
        <div style={{ height: 240, padding: 8 }}>...and back up</div>
      </div>
    </div>
  );
};
