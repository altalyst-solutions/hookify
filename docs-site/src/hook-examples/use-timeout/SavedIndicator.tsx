import { useTimeout } from "@altalyst/hookify";
import { useState } from "react";

export const SavedIndicator = () => {
  const [saved, setSaved] = useState(false);

  // `autoStart: false` keeps the timer idle until `start` is called, and
  // calling `start` again restarts the countdown from the full delay.
  const { start, cancel, isPending } = useTimeout(
    () => {
      console.log("Indicator hidden");
      setSaved(false);
    },
    2000,
    { autoStart: false }
  );

  const save = () => {
    console.log(isPending() ? "Restarting the timer" : "Starting the timer");
    setSaved(true);
    start();
  };

  const dismiss = () => {
    cancel();
    setSaved(false);
  };

  return (
    <div>
      <h2>Start on demand (restart on every click)</h2>
      <button onClick={save}>Save</button>{" "}
      <button onClick={dismiss} disabled={!saved}>
        Dismiss now
      </button>
      <p>{saved ? "Saved ✓ (hides 2s after the last click)" : "Not saved"}</p>
      <p>
        Click <strong>Save</strong> repeatedly: the indicator only hides 2
        seconds after your last click. Watch the <strong>Console</strong> tab.
      </p>
    </div>
  );
};
