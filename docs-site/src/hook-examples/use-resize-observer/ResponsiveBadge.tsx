import { useState } from "react";
import { useResizeObserver } from "@altalyst/hookify";

// A custom hook built on top: any consumer can wrap the primitive like this.
const useWidth = <T extends Element>() => {
  const [width, setWidth] = useState(0);
  const ref = useResizeObserver<T>(
    (entry) => {
      const { inlineSize } = entry.borderBoxSize[0];
      setWidth(Math.round(inlineSize));
    },
    { box: "border-box" }
  );
  return { ref, width };
};

export const ResponsiveBadge = () => {
  const { ref, width } = useWidth<HTMLDivElement>();
  const label = width >= 360 ? "Wide" : width >= 240 ? "Medium" : "Narrow";

  return (
    <div>
      <h2>Build your own hook</h2>
      <p>
        <code>useWidth</code> wraps <code>useResizeObserver</code> and keeps the
        width in state: {label} ({width}px).
      </p>
      <div
        ref={ref}
        style={{
          resize: "horizontal",
          overflow: "auto",
          width: 300,
          minWidth: 120,
          maxWidth: "100%",
          padding: 8,
          border: "1px solid",
          borderRadius: 4,
        }}
      >
        Drag the corner to resize.
      </div>
    </div>
  );
};
