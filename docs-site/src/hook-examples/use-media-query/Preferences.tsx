import { useMediaQuery } from "@altalyst/hookify";

export const Preferences = () => {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)", {
    onChange: (dark) => console.log(`Color scheme: ${dark ? "dark" : "light"}`),
  });
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const canHover = useMediaQuery("(hover: hover)");
  const isLandscape = useMediaQuery("(orientation: landscape)");

  return (
    <div>
      <h2>User preferences and capabilities</h2>
      <p>
        Change your OS theme or reduced-motion setting and watch the values
        update. Open the <strong>Console</strong> tab for the{" "}
        <code>onChange</code> log.
      </p>
      <ul>
        <li>Dark mode: {prefersDark ? "yes" : "no"}</li>
        <li>Reduced motion: {reducedMotion ? "yes" : "no"}</li>
        <li>Hover-capable pointer: {canHover ? "yes" : "no"}</li>
        <li>Landscape: {isLandscape ? "yes" : "no"}</li>
      </ul>
    </div>
  );
};
