import { useState } from "react";
import { useIntersectionObserver } from "@altalyst/hookify";

export const ScrollTracker = () => {
  // The scroll container is the observer's root, so visibility is measured
  // inside it rather than in the browser viewport.
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(true);

  const { ref, isIntersecting, entry } =
    useIntersectionObserver<HTMLDivElement>({
      root,
      threshold: [0, 0.25, 0.5, 0.75, 1],
      enabled,
      onChange: (e) => console.log("ratio", e.intersectionRatio.toFixed(2)),
    });

  const ratio = Math.round((entry?.intersectionRatio ?? 0) * 100);

  return (
    <div>
      <h2>Scroll tracker</h2>
      <p>
        Scroll the box. Target is{" "}
        <strong>{isIntersecting ? "visible" : "hidden"}</strong> ({ratio}%).
      </p>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />{" "}
        Observe
      </label>
      <div
        ref={setRoot}
        style={{
          height: 140,
          overflowY: "auto",
          marginTop: 8,
          border: "1px solid",
          borderRadius: 4,
        }}
      >
        <div style={{ height: 200, padding: 8 }}>Scroll down...</div>
        <div
          ref={ref}
          style={{
            height: 80,
            margin: "0 8px",
            padding: 8,
            borderRadius: 4,
            background: isIntersecting ? "seagreen" : "gray",
            color: "white",
          }}
        >
          Target
        </div>
        <div style={{ height: 200, padding: 8 }}>...and back up</div>
      </div>
    </div>
  );
};
