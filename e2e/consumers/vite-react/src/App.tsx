import { useDebouncedValue, useToggleState } from "@altalyst/hookify";

export const App = () => {
  const [open, toggle] = useToggleState(false);
  const label = useDebouncedValue(open ? "open" : "closed", 100);

  return (
    <button type="button" onClick={toggle}>
      {label}
    </button>
  );
};
