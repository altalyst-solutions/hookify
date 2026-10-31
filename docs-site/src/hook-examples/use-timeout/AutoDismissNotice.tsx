import { useTimeout } from "@altalyst/hookify";
import { useState } from "react";

export const AutoDismissNotice = () => {
  const [visible, setVisible] = useState(true);
  const [hovered, setHovered] = useState(false);

  // A `null` delay means no timer: hovering pauses the countdown, and
  // leaving it (or showing the notice again) starts a fresh 3 seconds.
  useTimeout(
    () => {
      console.log("Notice dismissed");
      setVisible(false);
    },
    visible && !hovered ? 3000 : null
  );

  return (
    <div>
      <h2>Auto-dismiss (pause on hover)</h2>
      {visible ? (
        <p
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{ padding: 12, border: "1px solid", borderRadius: 4 }}
        >
          Your changes were published. This notice closes after 3 seconds, but
          hovering over it pauses the countdown.
        </p>
      ) : (
        <button onClick={() => setVisible(true)}>Show notice again</button>
      )}
    </div>
  );
};
