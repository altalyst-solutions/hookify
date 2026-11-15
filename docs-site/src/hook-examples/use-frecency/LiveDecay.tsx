import { useFrecency } from "@altalyst/hookify";
import { useEffect, useState } from "react";

const DOCUMENTS = [
  "Budget.xlsx",
  "Roadmap.md",
  "Meeting notes",
  "Invoice 0042",
  "Logo.svg",
  "Trip plan",
];

export const LiveDecay = () => {
  // Scores halve every 20 seconds, only the 4 best items are kept, and they
  // are forgotten when the tab closes.
  const { record, rank, score, remove, clear } = useFrecency<string>(
    "hookify-demo-recent-documents",
    { halfLifeMs: 20_000, maxItems: 4, storage: sessionStorage }
  );
  const [, setTick] = useState(0);

  // Scores shrink as time passes without any state changing, so re-render.
  useEffect(() => {
    const id = setInterval(() => setTick((tick) => tick + 1), 500);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <h2>Decay and limits</h2>
      <p>
        <code>halfLifeMs: 20000</code> and <code>maxItems: 4</code>. Open
        several documents, then watch the scores shrink. The order only changes
        when you open something, because every score decays at the same rate.
        Opening a fifth document drops the lowest-scored one.
      </p>
      <button onClick={clear}>Forget all</button>
      <ul>
        {rank(DOCUMENTS).map((name) => {
          const value = score(name);
          return (
            <li key={name}>
              <button onClick={() => record(name)}>{name}</button>{" "}
              <progress value={Math.min(value, 4)} max={4} />{" "}
              <small>{value > 0 ? value.toFixed(2) : "not tracked"}</small>{" "}
              {value > 0 && (
                <button onClick={() => remove(name)}>Forget</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
