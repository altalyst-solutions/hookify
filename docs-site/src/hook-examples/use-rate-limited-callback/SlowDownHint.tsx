import { useRateLimitedCallback } from "@altalyst/hookify";
import { useState } from "react";

export const SlowDownHint = () => {
  const [lastSearch, setLastSearch] = useState("");
  const [hint, setHint] = useState(false);

  const search = useRateLimitedCallback(
    (query: string) => {
      console.log(`Searching "${query}"`);
      setLastSearch(query);
      setHint(false);
    },
    { limit: 4, windowMs: 4000, onLimited: () => setHint(true) }
  );

  return (
    <div>
      <h2>Slow down hint (onLimited)</h2>
      <p>Type fast: after 4 searches in a row, the rest are skipped.</p>
      <input placeholder="Search..." onChange={(e) => search(e.target.value)} />
      <p>Last search: {lastSearch || "none"}</p>
      {hint && <p>You're typing too fast, results may be out of date.</p>}
    </div>
  );
};
