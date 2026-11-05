import { useAsync } from "@altalyst/hookify";

// Simulated request that fails every other time.
let calls = 0;
const saveSettings = () =>
  new Promise<string>((resolve, reject) => {
    setTimeout(() => {
      calls += 1;
      if (calls % 2 === 0) resolve("Settings saved");
      else reject(new Error("Network error"));
    }, 600);
  });

export const SaveSettings = () => {
  // `run` resolves with the outcome instead of throwing, so a handler can
  // branch on it without `try`/`catch`.
  const { run, isPending, data, error } = useAsync(saveSettings, {
    onSuccess: (message) => console.log(message),
  });

  const save = async () => {
    const result = await run();
    console.log(result.ok ? "Done" : "Failed, try again");
  };

  return (
    <div>
      <h2>Save with retry</h2>
      <button onClick={save} disabled={isPending}>
        {isPending ? "Saving..." : error ? "Retry" : "Save"}
      </button>
      {error && <p style={{ color: "crimson" }}>{(error as Error).message}</p>}
      {!error && data && <p>{data}</p>}
    </div>
  );
};
