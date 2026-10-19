import { useEventListener, useMediaQuery } from "@altalyst/hookify";
import { useState } from "react";

// Compose your own helpers on top of the hook
const useBreakpoint = (minWidth: number) =>
  useMediaQuery(`(min-width: ${minWidth}px)`);

export const Breakpoints = () => {
  const isTablet = useBreakpoint(450);
  const isDesktop = useBreakpoint(600);

  // Only to show the width the media queries are evaluated against
  const [width, setWidth] = useState(window.innerWidth);
  useEventListener("resize", () => setWidth(window.innerWidth));

  return (
    <div>
      <h2>Responsive breakpoints</h2>
      <p>
        Preview width: <strong>{width}px</strong>. Narrow your browser window
        below ~700px to cross each breakpoint.
      </p>
      <ul>
        <li>≥ 450px (tablet): {isTablet ? "yes" : "no"}</li>
        <li>≥ 600px (desktop): {isDesktop ? "yes" : "no"}</li>
      </ul>
      <p>
        Layout:{" "}
        <strong>
          {isDesktop ? "desktop" : isTablet ? "tablet" : "mobile"}
        </strong>
      </p>
    </div>
  );
};
