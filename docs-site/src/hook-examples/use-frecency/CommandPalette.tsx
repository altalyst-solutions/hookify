import { useFrecency } from "@altalyst/hookify";
import { useState } from "react";

const COMMANDS = [
  { id: "new-file", label: "New file" },
  { id: "open-file", label: "Open file" },
  { id: "save-all", label: "Save all" },
  { id: "find", label: "Find in files" },
  { id: "format", label: "Format document" },
  { id: "terminal", label: "Toggle terminal" },
  { id: "settings", label: "Open settings" },
  { id: "theme", label: "Change color theme" },
];

export const CommandPalette = () => {
  const [query, setQuery] = useState("");
  const [lastRun, setLastRun] = useState<string | null>(null);
  // The default half-life is 7 days, so scores barely move while you try it.
  const { record, rank, score, clear } = useFrecency<string>(
    "hookify-demo-commands"
  );

  const matches = COMMANDS.filter((command) =>
    command.label.toLowerCase().includes(query.trim().toLowerCase())
  );
  const labels = new Map(matches.map((command) => [command.id, command.label]));
  // Rank the matches: the commands you run most and most recently come first.
  const ranked = rank(matches.map((command) => command.id));

  return (
    <div>
      <h2>Command palette</h2>
      <p>
        Run a few commands. The ones you use most often and most recently move
        to the top, also after a reload. Type to filter, and the ranking applies
        to the matches.
      </p>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Type a command"
      />
      <button onClick={clear}>Reset</button>
      <ul>
        {ranked.map((id) => (
          <li key={id}>
            <button
              onClick={() => {
                record(id);
                setLastRun(labels.get(id) ?? id);
              }}
            >
              {labels.get(id)}
            </button>{" "}
            <small>score {score(id).toFixed(2)}</small>
          </li>
        ))}
      </ul>
      {matches.length === 0 && <p>No matching commands.</p>}
      {lastRun && <p>Last run: {lastRun}</p>}
    </div>
  );
};
