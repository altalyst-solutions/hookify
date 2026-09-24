import { useDebounce } from "@altalyst/hookify";
import { useEffect, useState } from "react";

export const WindowResize = () => {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const updateDimensions = () => {
    setDimensions({ width: window.innerWidth, height: window.innerHeight });
  };

  const debouncedUpdateDimensions = useDebounce(updateDimensions, 300);

  useEffect(() => {
    const handleResize = () => {
      debouncedUpdateDimensions();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [debouncedUpdateDimensions]);

  return (
    <div>
      <h2>Window Dimensions</h2>
      <p>Width: {dimensions.width}px</p>
      <p>Height: {dimensions.height}px</p>
    </div>
  );
};
