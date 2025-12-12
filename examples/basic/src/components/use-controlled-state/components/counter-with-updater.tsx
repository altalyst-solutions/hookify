import { useControlledState } from "@altalyst/hookify";

export const CounterWithUpdater = () => {
  const [count, setCount] = useControlledState<number>(
    undefined,
    0,
    (newValue: number) => console.log("Count changed to:", newValue)
  );

  return (
    <div>
      <h2>Counter with Updater Function</h2>
      <p>Demonstrates using updater functions like setState.</p>
      <p>Count: {count}</p>
      <button onClick={() => setCount((prev: number) => prev + 1)}>
        Increment
      </button>
      <button onClick={() => setCount((prev: number) => prev - 1)}>
        Decrement
      </button>
      <button onClick={() => setCount((prev: number) => prev * 2)}>
        Double
      </button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
};
