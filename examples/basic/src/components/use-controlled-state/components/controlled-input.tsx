import { useControlledState } from "@altalyst/hookify";
import { useState } from "react";

export const ControlledInput = () => {
  const [parentValue, setParentValue] = useState("Controlled by parent");

  const [value, setValue] = useControlledState<string>(
    parentValue,
    "",
    setParentValue
  );

  return (
    <div>
      <h2>Controlled Input</h2>
      <p>The parent component controls the state.</p>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type something..."
      />
      <p>Current value: {value}</p>
      <button onClick={() => setParentValue("Reset by parent")}>
        Parent Reset
      </button>
      <button onClick={() => setParentValue((prev) => prev.toUpperCase())}>
        Parent Uppercase
      </button>
    </div>
  );
};
