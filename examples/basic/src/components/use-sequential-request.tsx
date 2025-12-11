import { useSequentialRequest } from "@altalyst/hookify";

const fetchUsers = async (signal: AbortSignal) => {
  const res = await fetch("https://jsonplaceholder.typicode.com/users", {
    signal,
  });
  return await res.text();
};

export const UseSequentialRequest = () => {
  const runQuery = useSequentialRequest(fetchUsers);

  return (
    <>
      <h2>Open the Network DevTools to track the cancellations</h2>
      <p>
        While the Network DevTools are open, repeatedly click the “Run Query”
        button and observe how the previous network calls are being canceled.
      </p>
      <button onClick={runQuery}>Run Query</button>
    </>
  );
};
