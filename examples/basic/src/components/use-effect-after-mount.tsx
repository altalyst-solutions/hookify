import { useEffectAfterMount } from "@altalyst/hookify";
import { useState } from "react";

export const UseEffectAfterMount = () => {
  const [count, setCount] = useState(0);

  useEffectAfterMount(() => {
    console.log("Count has changed: ", count);
  }, [count]);

  return (
    <div>
      <p>Count: {count}</p>
      <button
        onClick={() => {
          setCount(count + 1);
        }}
      >
        Increment
      </button>
    </div>
  );
};
