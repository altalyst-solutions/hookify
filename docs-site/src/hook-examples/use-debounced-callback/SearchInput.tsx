import { useDebouncedCallback } from "@altalyst/hookify";
import { useState } from "react";

export const SearchInput = () => {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");

  const search = useDebouncedCallback((term: string) => {
    console.log(`Searching for: ${term}`);
    setSearched(term);
  }, 500);

  return (
    <div>
      <h2>Search (cancel / flush)</h2>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          search(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") search.flush();
          if (e.key === "Escape") {
            setQuery("");
            search.cancel();
          }
        }}
        placeholder="Type, then press Enter or Esc"
      />
      <p>
        Enter runs the search now. Esc clears the input and cancels it.
        <br />
        Last search: {searched || "none"}
      </p>
    </div>
  );
};
