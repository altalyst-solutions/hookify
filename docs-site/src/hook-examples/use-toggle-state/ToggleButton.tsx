import { useToggleState } from "@altalyst/hookify";

export const ToggleButton = () => {
  const [isActive, toggleActive] = useToggleState(false);

  return (
    <div>
      <h2>Controlled Component: Toggle Button</h2>
      <button
        onClick={toggleActive}
        style={{ background: isActive ? "green" : "red" }}
      >
        {isActive ? "Active" : "Inactive"}
      </button>
    </div>
  );
};
