import { useDebouncedValue } from "@altalyst/hookify";
import { useEffect, useState } from "react";

const FRUITS = ["Apple", "Apricot", "Banana", "Blueberry", "Cherry", "Grape"];

export const SearchPreview = () => {
  const [query, setQuery] = useState("");
  const [delay, setDelay] = useState(400);
  const debouncedQuery = useDebouncedValue(query, delay);

  // Runs only once typing pauses, not on every keystroke.
  useEffect(() => {
    console.log(`Searching for "${debouncedQuery}"`);
  }, [debouncedQuery]);

  const results = FRUITS.filter((fruit) =>
    fruit.toLowerCase().includes(debouncedQuery.toLowerCase())
  );

  return (
    <div>
      <h2>Debounced search</h2>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Type a fruit..."
      />
      <label style={{ display: "block", marginTop: 8 }}>
        Delay: {delay} ms
        <input
          type="range"
          min={0}
          max={1500}
          step={100}
          value={delay}
          onChange={(event) => setDelay(Number(event.target.value))}
        />
      </label>
      <p>
        Live: <code>{query || "(empty)"}</code> · Debounced:{" "}
        <code>{debouncedQuery || "(empty)"}</code>
      </p>
      <ul>
        {results.map((fruit) => (
          <li key={fruit}>{fruit}</li>
        ))}
      </ul>
    </div>
  );
};
