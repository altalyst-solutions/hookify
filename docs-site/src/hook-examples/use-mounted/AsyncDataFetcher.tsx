import { useMounted } from "@altalyst/hookify";
import { useState } from "react";

interface User {
  id: number;
  name: string;
}

export const AsyncDataFetcher = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const isMounted = useMounted();

  const fetchUser = async () => {
    setLoading(true);
    try {
      // Simulate a slow API call
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const response = await fetch(
        "https://jsonplaceholder.typicode.com/users/1"
      );
      const data = await response.json();

      // Only update state if component is still mounted
      if (isMounted()) {
        setUser(data);
        setLoading(false);
      }
    } catch (error) {
      if (isMounted()) {
        console.error("Error fetching user:", error);
        setLoading(false);
      }
    }
  };

  return (
    <div style={{ padding: "20px", border: "1px solid #ccc", margin: "10px" }}>
      <h2>Async Data Fetcher</h2>
      <p>
        This example prevents state updates after unmounting by checking{" "}
        <code>isMounted()</code> before setting state.
      </p>
      <button onClick={fetchUser} disabled={loading}>
        {loading ? "Fetching..." : "Fetch User"}
      </button>
      {user && (
        <div style={{ marginTop: "10px" }}>
          <strong>User:</strong> {user.name}
        </div>
      )}
      <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
        Try clicking "Fetch User" and quickly navigating away. No memory leaks!
      </p>
    </div>
  );
};
