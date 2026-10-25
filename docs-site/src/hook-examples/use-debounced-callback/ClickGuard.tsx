import { useDebouncedCallback } from "@altalyst/hookify";
import { useState } from "react";

export const ClickGuard = () => {
  const [leading, setLeading] = useState(true);
  const [trailing, setTrailing] = useState(false);
  const [count, setCount] = useState(0);

  const submit = useDebouncedCallback(
    () => {
      console.log("Submitted");
      setCount((value) => value + 1);
    },
    1000,
    { leading, trailing }
  );

  return (
    <div>
      <h2>Click guard (leading / trailing)</h2>
      <button onClick={() => submit()}>Submit</button>
      <p>Submitted {count} time(s). Click rapidly and compare the options.</p>
      <label>
        <input
          type="checkbox"
          checked={leading}
          onChange={(e) => setLeading(e.target.checked)}
        />{" "}
        leading
      </label>{" "}
      <label>
        <input
          type="checkbox"
          checked={trailing}
          onChange={(e) => setTrailing(e.target.checked)}
        />{" "}
        trailing
      </label>
    </div>
  );
};
