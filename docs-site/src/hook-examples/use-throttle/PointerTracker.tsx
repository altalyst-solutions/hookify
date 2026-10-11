import { useThrottle } from "@altalyst/hookify";
import { useState } from "react";

export const PointerTracker = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const throttled = useThrottle(position, 500);

  return (
    <div>
      <h2>Pointer Tracker</h2>
      <p>Move the pointer over the box.</p>
      <div
        onPointerMove={(e) => setPosition({ x: e.clientX, y: e.clientY })}
        style={{ height: 120, border: "1px dashed gray", padding: 8 }}
      >
        <p>
          Live: {position.x}, {position.y}
        </p>
        <p>
          Throttled (500ms): {throttled.x}, {throttled.y}
        </p>
      </div>
    </div>
  );
};
