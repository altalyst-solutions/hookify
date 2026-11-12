import { useWebLock } from "@altalyst/hookify";
import { useState } from "react";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const SkipIfBusy = () => {
  const [message, setMessage] = useState("Not started");
  const { run, isHeld } = useWebLock("hookify-demo-sync", {
    ifAvailable: true,
  });

  const sync = async () => {
    const result = await run(async () => {
      await sleep(3000);
      return "Synced";
    });
    setMessage(result ?? "Skipped: another sync is already running");
  };

  return (
    <div>
      <h2>Skip if busy (ifAvailable)</h2>
      <p>
        Click twice quickly: the second click is skipped and <code>run</code>{" "}
        resolves <code>undefined</code>.
      </p>
      <button onClick={sync}>{isHeld ? "Syncing..." : "Sync"}</button>
      <p>{message}</p>
    </div>
  );
};
