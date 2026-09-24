import { useToggleState } from "@altalyst/hookify";

export const MultiToggle = () => {
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
