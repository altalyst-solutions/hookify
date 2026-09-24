import { useMounted } from "@altalyst/hookify";
import { useState } from "react";

const Timer = () => {
  const [seconds, setSeconds] = useState(0);

  useMounted({
    onMount: () => {
      console.log("⏱️  Timer started");
      const interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);

      // Return cleanup function to clear interval
      return () => {
        clearInterval(interval);
        console.log("⏱️  Timer stopped and cleaned up");
      };
    },
    onUnmount: () => {
      console.log("Timer component unmounted");
    },
  });

  return (
    <div
      style={{
        padding: "15px",
        background: "#f0f0f0",
        borderRadius: "8px",
        textAlign: "center",
      }}
    >
      <h3>Running Timer</h3>
      <div style={{ fontSize: "32px", fontWeight: "bold", color: "#2196f3" }}>
        {seconds}s
      </div>
      <p style={{ fontSize: "12px", color: "#666" }}>
        Timer automatically starts on mount and cleans up on unmount
      </p>
    </div>
  );
};

export const TimerComponent = () => {
  const [showTimer, setShowTimer] = useState(false);

  return (
    <div style={{ padding: "20px", border: "1px solid #ccc", margin: "10px" }}>
      <h2>Timer with Auto-Cleanup</h2>
      <p>
        This example demonstrates automatic cleanup of intervals using the{" "}
        <code>onMount</code> cleanup function.
      </p>
      <button onClick={() => setShowTimer(!showTimer)}>
        {showTimer ? "Stop Timer" : "Start Timer"}
      </button>
      <div style={{ marginTop: "15px" }}>{showTimer && <Timer />}</div>
      <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
        💡 Notice how the interval is automatically cleaned up when you stop the
        timer. Check the console!
      </p>
    </div>
  );
};
