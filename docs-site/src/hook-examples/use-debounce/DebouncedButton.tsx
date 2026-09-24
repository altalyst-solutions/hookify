import { useDebounce } from "@altalyst/hookify";

export const DebouncedButton = () => {
  const logMessage = (message: string) => {
    console.log(message);
  };

  const debouncedLogMessage = useDebounce(logMessage, 500);

  return (
    <div>
      <h2>Debounced Button</h2>
      <p>Open the console to see the log message.</p>
      <button onClick={() => debouncedLogMessage("Button clicked!")}>
        Click Me
      </button>
    </div>
  );
};
