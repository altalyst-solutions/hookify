import { useDocVisible } from "@altalyst/hookify";
import { useEffect, useRef } from "react";

export const VideoPlayer = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVisible = useDocVisible({
    onChange: (visible) => {
      console.log(
        `📹 Tab visibility changed: ${visible ? "visible" : "hidden"}`
      );
      if (videoRef.current) {
        if (visible) {
          videoRef.current.play().catch(() => {
            // Handle play rejection (e.g., user hasn't interacted with the page yet)
          });
        } else {
          videoRef.current.pause();
        }
      }
    },
  });

  useEffect(() => {
    // Auto-play on mount if tab is visible
    if (isVisible && videoRef.current) {
      videoRef.current.play().catch(() => {
        // Handle autoplay restrictions
      });
    }
  }, [isVisible]);

  return (
    <div style={{ padding: "20px", border: "1px solid #ccc", margin: "10px" }}>
      <h2>Auto-Pause Video Player</h2>
      <p>
        This video automatically pauses when you switch tabs and resumes when
        you return.
      </p>
      <div
        style={{
          marginTop: "15px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <video
          ref={videoRef}
          width="100%"
          height="300"
          controls
          loop
          style={{ borderRadius: "8px" }}
        >
          <source
            src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            type="video/mp4"
          />
          Your browser does not support the video tag.
        </video>
        <div
          style={{
            padding: "10px",
            background: isVisible ? "#e8f5e9" : "#fff3e0",
            borderRadius: "4px",
            textAlign: "center",
          }}
        >
          <strong>Tab Status:</strong> {isVisible ? "👁️ Visible" : "🙈 Hidden"}
        </div>
      </div>
      <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
        💡 Try switching to another tab and coming back. Check the console for
        logs!
      </p>
    </div>
  );
};
