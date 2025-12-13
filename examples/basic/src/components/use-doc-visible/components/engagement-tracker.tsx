import { useDocVisible } from "@altalyst/hookify";
import { useEffect, useRef, useState } from "react";

interface EngagementStats {
  totalTime: number;
  visibleTime: number;
  hiddenTime: number;
  tabSwitches: number;
}

export const EngagementTracker = () => {
  const isVisible = useDocVisible();
  const [stats, setStats] = useState<EngagementStats>({
    totalTime: 0,
    visibleTime: 0,
    hiddenTime: 0,
    tabSwitches: 0,
  });
  const intervalRef = useRef<number>();
  const previousVisibilityRef = useRef(isVisible);

  useEffect(() => {
    // Track tab switches
    if (previousVisibilityRef.current !== isVisible) {
      setStats((prev) => ({ ...prev, tabSwitches: prev.tabSwitches + 1 }));
      console.log(
        `📊 Tab visibility changed: ${isVisible ? "visible" : "hidden"}`
      );
    }
    previousVisibilityRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      setStats((prev) => ({
        ...prev,
        totalTime: prev.totalTime + 1,
        visibleTime: isVisible ? prev.visibleTime + 1 : prev.visibleTime,
        hiddenTime: !isVisible ? prev.hiddenTime + 1 : prev.hiddenTime,
      }));
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isVisible]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const engagementRate =
    stats.totalTime > 0
      ? ((stats.visibleTime / stats.totalTime) * 100).toFixed(1)
      : "0.0";

  return (
    <div style={{ padding: "20px", border: "1px solid #ccc", margin: "10px" }}>
      <h2>User Engagement Tracker</h2>
      <p>
        Track how much time users actually spend viewing your page versus having
        it open in a background tab.
      </p>
      <div
        style={{
          marginTop: "15px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "15px",
        }}
      >
        <div
          style={{
            background: "#e3f2fd",
            padding: "15px",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
            Total Time
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "bold", color: "#1976d2" }}
          >
            {formatTime(stats.totalTime)}
          </div>
        </div>
        <div
          style={{
            background: "#e8f5e9",
            padding: "15px",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
            Visible Time
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "bold", color: "#388e3c" }}
          >
            {formatTime(stats.visibleTime)}
          </div>
        </div>
        <div
          style={{
            background: "#fff3e0",
            padding: "15px",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
            Hidden Time
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "bold", color: "#f57c00" }}
          >
            {formatTime(stats.hiddenTime)}
          </div>
        </div>
        <div
          style={{
            background: "#f3e5f5",
            padding: "15px",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
            Tab Switches
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "bold", color: "#7b1fa2" }}
          >
            {stats.tabSwitches}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: "15px",
          padding: "15px",
          background: isVisible ? "#e8f5e9" : "#ffebee",
          borderRadius: "8px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>
            <strong>Current Status:</strong>{" "}
            {isVisible ? "👁️ Viewing Page" : "🙈 Tab Hidden"}
          </span>
          <span
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: isVisible ? "#4caf50" : "#f44336",
            }}
          >
            {engagementRate}% engaged
          </span>
        </div>
      </div>
      <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
        💡 This is useful for analytics to understand real user engagement vs.
        just page loads.
      </p>
    </div>
  );
};
