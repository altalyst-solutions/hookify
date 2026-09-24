import { usePersistedState } from "@altalyst/hookify";

export const Counter = () => {
  const [count, setCount] = usePersistedState<number>("counter", 0);

  const increment = () => setCount((prev) => prev + 1);
  const decrement = () => setCount((prev) => prev - 1);

  return (
    <div>
      <h2>Counter</h2>
      <p>Value: {count}</p>
      <button onClick={increment}>Increment</button>
      <button onClick={decrement}>Decrement</button>
    </div>
  );
};
