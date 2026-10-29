import { useIsomorphicLayoutEffect } from "@altalyst/hookify";
import { useEffect, useState } from "react";

export const EffectTimeline = () => {
  const [count, setCount] = useState(0);

  console.log(`render #${count}`);

  useEffect(() => {
    console.log(`  useEffect #${count} (after paint)`);
    return () => console.log(`  useEffect cleanup #${count}`);
  }, [count]);

  // Declared after useEffect, yet it still runs first: before the browser paints.
  useIsomorphicLayoutEffect(() => {
    console.log(`  useIsomorphicLayoutEffect #${count} (before paint)`);
    return () => console.log(`  useIsomorphicLayoutEffect cleanup #${count}`);
  }, [count]);

  return (
    <div>
      <h2>Effect timeline</h2>
      <p>
        Open the <strong>Console</strong> tab and click the button to see the
        order in which each phase runs.
      </p>
      <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>
    </div>
  );
};
