import { useDocVisible } from "@altalyst/hookify";
import { useEffect, useRef, useState } from "react";

interface DataPoint {
  timestamp: string;
  value: number;
}

export const ApiPoller = () => {
  const isVisible = useDocVisible();
  const [data, setData] = useState<DataPoint[]>([]);
  const [pollCount, setPollCount] = useState(0);
  const intervalRef = useRef<number>();

  useEffect(() => {
    if (isVisible) {
      console.log("🔄 Starting API polling (tab visible)");

      // Simulate API call immediately
      const fetchData = () => {
        const newDataPoint: DataPoint = {
          timestamp: new Date().toLocaleTimeString(),
          value: Math.floor(Math.random() * 100),
        };
        setData((prev) => [...prev.slice(-9), newDataPoint]);
        setPollCount((prev) => prev + 1);
      };

      fetchData();
      intervalRef.current = window.setInterval(fetchData, 2000);
    } else {
      console.log("⏸️  Pausing API polling (tab hidden)");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isVisible]);

  return (
    <div style={{ padding: "20px", border: "1px solid #ccc", margin: "10px" }}>
      <h2>Smart API Polling</h2>
      <p>
        This component polls an API every 2 seconds, but automatically pauses
        when the tab is hidden to save resources.
      </p>
      <div
        style={{
          marginTop: "15px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div
          style={{
            padding: "10px",
            background: isVisible ? "#e8f5e9" : "#ffebee",
            borderRadius: "4px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>
            <strong>Polling Status:</strong>{" "}
            {isVisible ? "🟢 Active" : "🔴 Paused"}
          </span>
          <span style={{ fontSize: "12px", color: "#666" }}>
            Total polls: {pollCount}
          </span>
        </div>
        <div
          style={{
            background: "#f5f5f5",
            padding: "15px",
            borderRadius: "8px",
            maxHeight: "300px",
            overflowY: "auto",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Recent Data Points:</h3>
          {data.length === 0 ? (
            <p style={{ color: "#999" }}>No data yet...</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {data.map((point, index) => (
                <li
                  key={index}
                  style={{
                    padding: "8px",
                    background: "white",
                    marginBottom: "5px",
                    borderRadius: "4px",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ color: "#666" }}>{point.timestamp}</span>
                  <span style={{ fontWeight: "bold", color: "#2196f3" }}>
                    {point.value}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
        💡 Switch tabs to see polling pause automatically. Watch the total poll
        count!
      </p>
    </div>
  );
};
