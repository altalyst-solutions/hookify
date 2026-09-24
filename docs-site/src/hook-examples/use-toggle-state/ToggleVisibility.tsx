import { useToggleState } from "@altalyst/hookify";

export const ToggleVisibility = () => {
  const [isVisible, toggleVisibility] = useToggleState(false);

  return (
    <div>
      <h2>Toggle Visibility</h2>
      <button onClick={toggleVisibility}>
        {isVisible ? "Hide" : "Show"} Content
      </button>
      {isVisible && <p>This is some toggleable content!</p>}
    </div>
  );
};
