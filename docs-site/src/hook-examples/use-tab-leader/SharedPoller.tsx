import { useInterval, useTabLeader } from "@altalyst/hookify";
import { useState } from "react";

const Poller = ({ name, onClose }: { name: string; onClose: () => void }) => {
  const [value, setValue] = useState<number | null>(null);
  const { isLeader, broadcast } = useTabLeader<number>("hookify-demo-poller", {
    onMessage: setValue,
  });

  // Only the leader "fetches", then shares the result with the other tabs.
  useInterval(
    () => {
      const next = Math.round(Math.random() * 100);
      console.log(`${name} fetched ${next}`);
      setValue(next);
      broadcast(next);
    },
    isLeader ? 2000 : null,
    { immediate: true }
  );

  return (
    <p>
      <strong>{name}</strong> ({isLeader ? "fetching" : "listening"}):{" "}
      {value ?? "waiting for data..."} <button onClick={onClose}>Close</button>
    </p>
  );
};

const NAMES = ["Poller 1", "Poller 2", "Poller 3"];

export const SharedPoller = () => {
  const [closed, setClosed] = useState<string[]>([]);
  const toggle = (name: string) =>
    setClosed((list) =>
      list.includes(name) ? list.filter((n) => n !== name) : [...list, name]
    );

  return (
    <div>
      <h2>Leader polls, everyone shows the result</h2>
      <p>
        Only the leader runs the timer and broadcasts each value. Close the
        fetching poller and another one takes over the polling.
      </p>
      {NAMES.map((name) =>
        closed.includes(name) ? (
          <p key={name}>
            <strong>{name}</strong>: closed{" "}
            <button onClick={() => toggle(name)}>Reopen</button>
          </p>
        ) : (
          <Poller key={name} name={name} onClose={() => toggle(name)} />
        )
      )}
    </div>
  );
};
