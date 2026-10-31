import { useElementSize } from "@altalyst/hookify";

const cards = ["Alpha", "Beta", "Gamma", "Delta"];

export const ContainerLayout = () => {
  // "border-box" includes the padding and border, which is what the
  // container's outer width means for layout decisions.
  const { ref, width } = useElementSize<HTMLDivElement>({
    box: "border-box",
    // Used on the server and until the first measurement.
    defaultSize: { width: 0, height: 0 },
  });

  // Unlike a media query, this reacts to the container, not the viewport.
  const columns = width >= 480 ? 4 : width >= 300 ? 2 : 1;

  return (
    <div>
      <h2>Container-based layout</h2>
      <p>
        Drag the corner to resize the container: {columns} column
        {columns === 1 ? "" : "s"} at {Math.round(width)}px.
      </p>
      <div
        ref={ref}
        style={{
          resize: "horizontal",
          overflow: "auto",
          width: 360,
          maxWidth: "100%",
          minWidth: 120,
          padding: 8,
          border: "1px solid",
          borderRadius: 4,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 8,
          }}
        >
          {cards.map((card) => (
            <div
              key={card}
              style={{ padding: 8, border: "1px solid", borderRadius: 4 }}
            >
              {card}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
