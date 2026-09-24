import { useControlledState } from "@altalyst/hookify";
import { useState } from "react";

interface CustomSelectProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: string[];
}

const CustomSelect = ({
  value,
  defaultValue = "",
  onChange,
  options,
}: CustomSelectProps) => {
  const [selectedValue, setSelectedValue] = useControlledState(
    value,
    defaultValue,
    onChange
  );

  return (
    <select
      value={selectedValue}
      onChange={(e) => setSelectedValue(e.target.value)}
      style={{ padding: "8px", fontSize: "14px" }}
    >
      <option value="">Select an option</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
};

export const CustomSelectDemo = () => {
  const [controlledValue, setControlledValue] = useState("React");
  const fruits = ["Apple", "Banana", "Orange", "Grape"];
  const frameworks = ["React", "Vue", "Angular", "Svelte"];

  return (
    <div>
      <h2>Reusable Component Pattern</h2>
      <p>
        Building a custom select component that works in both controlled and
        uncontrolled modes.
      </p>

      <div style={{ marginBottom: "20px" }}>
        <h3>Uncontrolled Mode</h3>
        <CustomSelect
          defaultValue="Banana"
          options={fruits}
          onChange={(val) => console.log("Fruit selected:", val)}
        />
      </div>

      <div>
        <h3>Controlled Mode</h3>
        <CustomSelect
          value={controlledValue}
          options={frameworks}
          onChange={setControlledValue}
        />
        <p>Selected framework: {controlledValue}</p>
        <button onClick={() => setControlledValue("Vue")}>
          Set to Vue (parent control)
        </button>
      </div>
    </div>
  );
};
