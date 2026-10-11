import { useThrottle } from "@altalyst/hookify";
import { useEffect, useState } from "react";

export const SliderValue = () => {
  const [value, setValue] = useState(50);
  const [leading, setLeading] = useState(true);
  const [trailing, setTrailing] = useState(true);
  const throttled = useThrottle(value, 1000, { leading, trailing });

  useEffect(() => {
    console.log(`Throttled value: ${throttled}`);
  }, [throttled]);

  return (
    <div>
      <h2>Slider (options)</h2>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />
      <p>
        Live: {value} — Throttled (1s): {throttled}
      </p>
      <label>
        <input
          type="checkbox"
          checked={leading}
          onChange={(e) => setLeading(e.target.checked)}
        />{" "}
        leading
      </label>{" "}
      <label>
        <input
          type="checkbox"
          checked={trailing}
          onChange={(e) => setTrailing(e.target.checked)}
        />{" "}
        trailing
      </label>
    </div>
  );
};
