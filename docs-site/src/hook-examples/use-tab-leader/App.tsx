import { useState } from "react";

import { SharedPoller } from "./SharedPoller";
import { Tab } from "./Tab";

const NAMES = ["Tab A", "Tab B", "Tab C"];

export default function App() {
  const [closed, setClosed] = useState<string[]>([]);
  const toggle = (name: string) =>
    setClosed((list) =>
      list.includes(name) ? list.filter((n) => n !== name) : [...list, name]
    );

  return (
    <>
      <h2>Simulated tabs</h2>
      <p>
        Each line is one hook instance, standing in for a browser tab. Close the
        leader and watch another take over. Open this page in a second browser
        tab and they all compete together.
      </p>
      {NAMES.map((name) =>
        closed.includes(name) ? (
          <p key={name}>
            <strong>{name}</strong>: closed{" "}
            <button onClick={() => toggle(name)}>Reopen</button>
          </p>
        ) : (
          <Tab key={name} name={name} onClose={() => toggle(name)} />
        )
      )}
      <SharedPoller />
    </>
  );
}
