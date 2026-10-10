import { useLatest } from "@altalyst/hookify";
import { useEffect, useState } from "react";

export const IntervalLogger = () => {
  const [count, setCount] = useState(0);
  const [ticks, setTicks] = useState(0);

  // Reads the latest count from a timer that is only created once.
  const countRef = useLatest(count);

  useEffect(() => {
    const id = setInterval(() => {
      setTicks((t) => t + 1);
      console.log(`Latest count: ${countRef.current}`);
    }, 1000);

    return () => clearInterval(id);
  }, [countRef]);

  return (
    <div>
      <h2>Interval Logger</h2>
      <p>
        Increment the counter and watch the <strong>Console</strong>: the
        interval is never recreated, yet it always logs the current value.
      </p>
      <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>
      <p>Ticks so far: {ticks}</p>
    </div>
  );
};
