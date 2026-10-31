import { useElementSize } from "@altalyst/hookify";

export const ResizableBox = () => {
  const { ref, width, height } = useElementSize<HTMLDivElement>({
    // Called whenever the size changes, with the raw ResizeObserver entry.
    onResize: ({ width, height }) =>
      console.log(`Resized to ${Math.round(width)} x ${Math.round(height)}`),
  });

  return (
    <div>
      <h2>Live size</h2>
      <p>Drag the bottom-right corner of the box to resize it.</p>
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
          border: "1px solid",
          borderRadius: 4,
          padding: 8,
        }}
      >
        {Math.round(width)} x {Math.round(height)} px
      </div>
    </div>
  );
};
