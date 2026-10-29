import { useIsomorphicLayoutEffect } from "@altalyst/hookify";
import { useRef, useState } from "react";

export const AutoGrowTextarea = () => {
  const [value, setValue] = useState(
    "Type here and add some lines.\nThe textarea grows to fit its content."
  );
  const ref = useRef<HTMLTextAreaElement>(null);

  // Runs after the DOM updates but before the browser paints, so the textarea
  // is never painted at the wrong height.
  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <div>
      <h2>Auto-growing textarea</h2>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        style={{ width: "100%", boxSizing: "border-box", resize: "none" }}
      />
      <p>{value.split("\n").length} line(s)</p>
    </div>
  );
};
