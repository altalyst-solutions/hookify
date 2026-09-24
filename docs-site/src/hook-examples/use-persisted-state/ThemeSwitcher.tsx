import { usePersistedState } from "@altalyst/hookify";

export const ThemeSwitcher = () => {
  const [theme, setTheme] = usePersistedState<"light" | "dark">(
    "theme",
    "light"
  );

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <div
      style={{
        background: theme === "dark" ? "#333" : "#fff",
        color: theme === "dark" ? "#fff" : "#000",
        padding: "1rem",
      }}
    >
      <h2>Theme Switcher</h2>
      <p>Current Theme: {theme}</p>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
};
