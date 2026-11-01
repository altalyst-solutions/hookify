import { useIntersectionObserver } from "@altalyst/hookify";

// A custom component built on top: any consumer can wrap the hook like this.
const Reveal = ({ children }: { children: string }) => {
  const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>({
    once: true,
    threshold: 0.5,
  });

  return (
    <div
      ref={ref}
      style={{
        padding: 12,
        border: "1px solid",
        borderRadius: 4,
        opacity: isIntersecting ? 1 : 0,
        transform: isIntersecting ? "none" : "translateY(16px)",
        transition: "opacity 400ms, transform 400ms",
      }}
    >
      {children}
    </div>
  );
};

export const LazyReveal = () => (
  <div>
    <h2>Reveal once</h2>
    <p>
      Each card fades in the first time it is half visible, then stops observing
      (<code>once: true</code>). Scroll the preview.
    </p>
    <div style={{ display: "grid", gap: 12, marginTop: 160 }}>
      {["First", "Second", "Third", "Fourth"].map((label) => (
        <div key={label} style={{ marginBottom: 120 }}>
          <Reveal>{`${label} card`}</Reveal>
        </div>
      ))}
    </div>
  </div>
);
