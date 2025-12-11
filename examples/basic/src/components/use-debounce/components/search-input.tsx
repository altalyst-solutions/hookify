import { useDebounce } from "@altalyst/hookify";
import type { ChangeEvent } from "react";
import { useState, useCallback } from "react";

export const SearchInput = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);

  const fetchResults = useCallback((searchQuery: string) => {
    console.log(`Fetching results for: ${searchQuery}`);
    // Simulate an API call
    setTimeout(() => {
      setResults([`${searchQuery} Result 1`, `${searchQuery} Result 2`]);
    }, 500);
  }, []);

  const debouncedFetchResults = useDebounce(fetchResults, 300);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setQuery(value);
    debouncedFetchResults(value);
  };

  return (
    <div>
      <h2>Search Input</h2>
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        placeholder="Search..."
      />
      <ul>
        {results.map((result, index) => (
          <li key={index}>{result}</li>
        ))}
      </ul>
    </div>
  );
};
