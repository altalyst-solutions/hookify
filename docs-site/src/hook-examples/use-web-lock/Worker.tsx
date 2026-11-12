import { useWebLock } from "@altalyst/hookify";
import { useState } from "react";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const Worker = ({ name }: { name: string }) => {
  const [done, setDone] = useState(0);
  const { run, isPending, isHeld } = useWebLock("hookify-demo-exclusive");

  const start = async () => {
    await run(async () => {
      console.log(`${name} got the lock`);
      await sleep(2000);
      console.log(`${name} released the lock`);
    });
    setDone((n) => n + 1);
  };

  return (
    <div>
      <strong>{name}</strong>: <button onClick={start}>Run 2s task</button>{" "}
      {isHeld && "working, holding the lock..."}
      {isPending && "waiting for the lock..."}
      {!isHeld && !isPending && `idle (${done} done)`}
    </div>
  );
};
