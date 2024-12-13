import { useToggleState } from "@altalyst/hookify";

const ToggleVisibility = () => {
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

const ToggleButton = () => {
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

const MultiToggle = () => {
  const [isLightOn, toggleLight] = useToggleState(false);
  const [isFanOn, toggleFan] = useToggleState(false);

  return (
    <div>
      <h2>Multi Toggle</h2>
      <button onClick={toggleLight}>
        {isLightOn ? "Turn Off Light" : "Turn On Light"}
      </button>
      <button onClick={toggleFan}>
        {isFanOn ? "Turn Off Fan" : "Turn On Fan"}
      </button>
    </div>
  );
};

const PasswordField = () => {
  const [isPasswordVisible, togglePasswordVisibility] = useToggleState(false);

  return (
    <div>
      <h2>Password Field</h2>
      <input
        type={isPasswordVisible ? "text" : "password"}
        placeholder="Enter your password"
      />
      <button onClick={togglePasswordVisibility}>
        {isPasswordVisible ? "Hide Password" : "Show Password"}
      </button>
    </div>
  );
};

export const UseToggleState = () => {
  return (
    <>
      <ToggleVisibility />
      <ToggleButton />
      <MultiToggle />
      <PasswordField />
    </>
  );
};
