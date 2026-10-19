import { useClipboard } from "@altalyst/hookify";
import { useState } from "react";

export const CopyField = () => {
  const [text, setText] = useState("Anything you like");
  const { copy, copied, reset } = useClipboard({
    timeout: null,
    onCopy: (value) => console.log(`Copied "${value}"`),
    onError: (error) => console.log(`Failed: ${error.message}`),
  });

  return (
    <div>
      <h2>Custom options (no auto-reset)</h2>
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          reset();
        }}
      />{" "}
      <button onClick={() => copy(text)}>Copy</button>
      <p>{copied ? "Copied. Stays until you edit the text." : "Not copied"}</p>
    </div>
  );
};
