import { useEventListener } from "@altalyst/hookify";
import { useRef, useState } from "react";

export const EventListenerDemo = () => {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [lastKey, setLastKey] = useState("(none)");
  const [clicks, setClicks] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  // window (default target)
  useEventListener("resize", () =>
    setSize({ width: window.innerWidth, height: window.innerHeight })
  );

  // document
  useEventListener("keydown", (e) => setLastKey(e.key), document);

  // element via ref; a null target attaches nothing, which acts as a toggle
  useEventListener(
    "click",
    () => setClicks((c) => c + 1),
    enabled ? boxRef : null
  );

  return (
    <div>
      <h2>useEventListener</h2>
      <p>
        Window size: {size.width} × {size.height} (resize the window)
      </p>
      <p>
        Last key pressed: <kbd>{lastKey}</kbd> (click here, then type)
      </p>
      <div
        ref={boxRef}
        style={{ padding: 16, border: "1px dashed gray", cursor: "pointer" }}
      >
        Click me. Clicks counted: {clicks}
      </div>
      <button onClick={() => setEnabled((v) => !v)}>
        {enabled ? "Detach" : "Attach"} click listener
      </button>
    </div>
  );
};
