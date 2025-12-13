import { useDocVisible } from "@altalyst/hookify";
import { useEffect, useRef, useState } from "react";

export const CountdownTimer = () => {
  const isVisible = useDocVisible();
  const [seconds, setSeconds] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<number>();

  useEffect(() => {
    if (isRunning && isVisible && seconds > 0) {
      intervalRef.current = window.setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isVisible, seconds]);

  const handleStart = () => {
    if (seconds > 0) {
      setIsRunning(true);
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setSeconds(60);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{ padding: "20px", border: "1px solid #ccc", margin: "10px" }}>
      <h2>Smart Countdown Timer</h2>
      <p>
        This timer automatically pauses when you switch tabs, ensuring accurate
        timing even when the page isn't visible.
      </p>
      <div
        style={{
          marginTop: "15px",
          display: "flex",
          flexDirection: "column",
          gap: "15px",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: "64px",
            fontWeight: "bold",
            color: seconds === 0 ? "#f44336" : "#2196f3",
            fontFamily: "monospace",
          }}
        >
          {formatTime(seconds)}
        </div>
        <div
          style={{
            padding: "10px 20px",
            background: !isVisible && isRunning ? "#fff3e0" : "#f5f5f5",
            borderRadius: "4px",
            fontSize: "14px",
          }}
        >
          {!isVisible && isRunning ? (
            <span style={{ color: "#ff9800" }}>⏸️ Paused (tab hidden)</span>
          ) : isRunning ? (
            <span style={{ color: "#4caf50" }}>▶️ Running</span>
          ) : seconds === 0 ? (
            <span style={{ color: "#f44336" }}>⏰ Time's up!</span>
          ) : (
            <span style={{ color: "#999" }}>⏹️ Stopped</span>
          )}
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={seconds === 0}
              style={{
                padding: "10px 20px",
                fontSize: "16px",
                cursor: seconds === 0 ? "not-allowed" : "pointer",
                opacity: seconds === 0 ? 0.5 : 1,
              }}
            >
              Start
            </button>
          ) : (
            <button
              onClick={handlePause}
              style={{ padding: "10px 20px", fontSize: "16px" }}
            >
              Pause
            </button>
          )}
          <button
            onClick={handleReset}
            style={{ padding: "10px 20px", fontSize: "16px" }}
          >
            Reset
          </button>
        </div>
      </div>
      <p style={{ fontSize: "12px", color: "#666", marginTop: "15px" }}>
        💡 Start the timer and switch tabs. The timer will automatically pause
        and resume!
      </p>
    </div>
  );
};
