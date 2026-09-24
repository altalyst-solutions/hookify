import { useControlledState } from "@altalyst/hookify";

export const UncontrolledInput = () => {
  const [value, setValue] = useControlledState<string>(
    undefined,
    "",
    (newValue: string) => console.log("Value changed:", newValue)
  );

  return (
    <div>
      <h2>Uncontrolled Input</h2>
      <p>The component manages its own state internally.</p>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type something..."
      />
      <p>Current value: {value || "(empty)"}</p>
      <button onClick={() => setValue("")}>Clear</button>
    </div>
  );
};
