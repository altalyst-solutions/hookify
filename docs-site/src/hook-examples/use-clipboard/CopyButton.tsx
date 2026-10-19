import { useClipboard } from "@altalyst/hookify";

export const CopyButton = () => {
  const { copy, copied, error } = useClipboard();

  return (
    <div>
      <h2>Copy button</h2>
      <code>npm i @altalyst/hookify</code>{" "}
      <button onClick={() => copy("npm i @altalyst/hookify")}>
        {copied ? "Copied!" : "Copy"}
      </button>
      {error && (
        <p style={{ color: "crimson" }}>Copy failed: {error.message}</p>
      )}
    </div>
  );
};
