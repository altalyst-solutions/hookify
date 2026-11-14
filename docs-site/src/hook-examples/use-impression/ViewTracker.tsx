import { useImpression } from "@altalyst/hookify";
import { useState } from "react";

const CARDS = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];

const Card = ({
  name,
  root,
  threshold,
  minDurationMs,
  enabled,
  onSeen,
}: {
  name: string;
  root: HTMLElement | null;
  threshold: number;
  minDurationMs: number;
  enabled: boolean;
  onSeen: (name: string) => void;
}) => {
  // An inline callback is fine: the latest one is always used.
  const ref = useImpression<HTMLDivElement>(() => onSeen(name), {
    root,
    threshold,
    minDurationMs,
    enabled,
  });

  return (
    <div
      ref={ref}
      style={{
        height: 90,
        margin: "0 8px 70px",
        padding: 8,
        border: "1px solid",
        borderRadius: 4,
      }}
    >
      {name} card
    </div>
  );
};

export const ViewTracker = () => {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [threshold, setThreshold] = useState(0.5);
  const [minDurationMs, setMinDurationMs] = useState(1000);
  const [enabled, setEnabled] = useState(true);
  const [seen, setSeen] = useState<string[]>([]);

  return (
    <div>
      <h2>Track views (threshold and dwell time)</h2>
      <p>
        Scroll the box slowly. A card is reported once it has been at least{" "}
        {Math.round(threshold * 100)}% visible for {minDurationMs} ms. Scroll
        past quickly and nothing is reported. Open the <strong>Console</strong>{" "}
        tab to see each impression.
      </p>
      <p>
        <label>
          Threshold:{" "}
          <select
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          >
            <option value={0.25}>25%</option>
            <option value={0.5}>50%</option>
            <option value={1}>100%</option>
          </select>
        </label>{" "}
        <label>
          Dwell time:{" "}
          <select
            value={minDurationMs}
            onChange={(e) => setMinDurationMs(Number(e.target.value))}
          >
            <option value={0}>0 ms</option>
            <option value={1000}>1 second</option>
            <option value={2000}>2 seconds</option>
          </select>
        </label>{" "}
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />{" "}
          Track
        </label>
      </p>
      <div
        ref={setRoot}
        style={{
          height: 180,
          overflowY: "auto",
          border: "1px solid",
          borderRadius: 4,
        }}
      >
        <div style={{ height: 120, padding: 8 }}>Scroll down...</div>
        {CARDS.map((name) => (
          <Card
            key={name}
            name={name}
            root={root}
            threshold={threshold}
            minDurationMs={minDurationMs}
            enabled={enabled}
            onSeen={(seenName) => {
              console.log(`impression: ${seenName}`);
              setSeen((list) => [...list, seenName]);
            }}
          />
        ))}
      </div>
      <p>
        Reported ({seen.length}): {seen.join(", ") || "none yet"}{" "}
        <button onClick={() => setSeen([])}>Clear</button>
      </p>
    </div>
  );
};
