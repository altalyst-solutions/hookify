import { useStableCallback } from "@altalyst/hookify";
import { memo, useEffect, useState } from "react";

type RowProps = { label: string; onPick: (label: string) => void };

const Row = memo(({ label, onPick }: RowProps) => {
  useEffect(() => {
    console.log(`Row "${label}" rendered`);
  });

  return (
    <li>
      <button onClick={() => onPick(label)}>{label}</button>
    </li>
  );
});

export const MemoizedList = () => {
  const [prefix, setPrefix] = useState("Picked");
  const [picked, setPicked] = useState("nothing yet");

  // A plain inline handler would be a new function on every render and
  // defeat `memo`. This one never changes, yet always sees the latest `prefix`.
  const handlePick = useStableCallback((label: string) => {
    setPicked(`${prefix}: ${label}`);
  });

  return (
    <div>
      <h2>Memoized rows</h2>
      <label>
        Prefix{" "}
        <input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
      </label>
      <ul>
        {["Apple", "Banana", "Cherry"].map((label) => (
          <Row key={label} label={label} onPick={handlePick} />
        ))}
      </ul>
      <p>{picked}</p>
      <p>
        Type in the prefix field and watch the <strong>Console</strong>: the
        rows do not re-render (React may render them twice on mount in
        development), yet picking one still uses the current prefix.
      </p>
    </div>
  );
};
