import { usePrevious } from "@altalyst/hookify";
import { useState } from "react";

export const CounterDiff = () => {
  const [count, setCount] = useState(0);
  const [other, setOther] = useState(0);

  const prevCount = usePrevious(count);
  const direction =
    prevCount === undefined || prevCount === count
      ? "unchanged"
      : count > prevCount
        ? "increased"
        : "decreased";

  return (
    <div>
      <h2>Counter Diff</h2>
      <p>
        Current: <strong>{count}</strong>
      </p>
      <p>
        Previous render: <strong>{prevCount ?? "undefined"}</strong>
      </p>
      <p>
        Direction: <strong>{direction}</strong>
      </p>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>{" "}
      <button onClick={() => setCount((c) => c - 1)}>Decrement</button>{" "}
      <button onClick={() => setOther((o) => o + 1)}>
        Unrelated rerender ({other})
      </button>
      <p>
        Clicking the unrelated button rerenders the component, so the previous
        value catches up to the current one.
      </p>
    </div>
  );
};
