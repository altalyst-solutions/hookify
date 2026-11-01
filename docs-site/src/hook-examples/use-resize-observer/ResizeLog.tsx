import { useRef, useState } from "react";
import { useResizeObserver } from "@altalyst/hookify";

export const ResizeLog = () => {
  const [enabled, setEnabled] = useState(true);
  // A ref instead of state: the box updates without re-rendering React.
  const readoutRef = useRef<HTMLSpanElement>(null);

  const ref = useResizeObserver<HTMLDivElement>(
    (entry) => {
      const { width, height } = entry.contentRect;
      if (readoutRef.current) {
        readoutRef.current.textContent = `${Math.round(width)} x ${Math.round(height)} px`;
      }
      console.log("resize", entry.target.tagName, width, height);
    },
    // Pause observing without unmounting anything.
    { enabled }
  );

  return (
    <div>
      <h2>Resize log</h2>
      <p>
        Drag the bottom-right corner. Size: <span ref={readoutRef}>-</span>
      </p>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />{" "}
        Observe
      </label>
      <div
        ref={ref}
        style={{
          resize: "both",
          overflow: "auto",
          width: 220,
          height: 100,
          minWidth: 120,
          minHeight: 60,
          maxWidth: "100%",
          marginTop: 8,
          border: "1px solid",
          borderRadius: 4,
          padding: 8,
        }}
      >
        Resize me
      </div>
    </div>
  );
};
