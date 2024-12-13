import { useToggleState } from "@altalyst/hookify";

export const PasswordField = () => {
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
