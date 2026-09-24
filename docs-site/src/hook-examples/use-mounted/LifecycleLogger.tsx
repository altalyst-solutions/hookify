import { useMounted } from "@altalyst/hookify";
import { useState } from "react";

const ComponentWithLifecycle = ({ id }: { id: number }) => {
  const [logs, setLogs] = useState<string[]>([]);

  useMounted({
    onMount: () => {
      const mountTime = new Date().toLocaleTimeString();
      setLogs((prev) => [
        ...prev,
        `✅ Component ${id} mounted at ${mountTime}`,
      ]);
      console.log(`Component ${id} mounted`);

      // Setup: Start logging
      const interval = setInterval(() => {
        console.log(`Component ${id} is still alive...`);
      }, 1000);

      // Cleanup function returned
      return () => {
        clearInterval(interval);
        console.log(`Component ${id} cleaned up interval`);
      };
    },
    onUnmount: () => {
      const unmountTime = new Date().toLocaleTimeString();
      console.log(`❌ Component ${id} unmounted at ${unmountTime}`);
    },
  });

  return (
    <div
      style={{
        padding: "10px",
        margin: "5px",
        border: "2px dashed #4caf50",
        borderRadius: "4px",
      }}
    >
      <h4>Component {id}</h4>
      <div style={{ fontSize: "12px" }}>
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
    </div>
  );
};

export const LifecycleLogger = () => {
  const [showComponent, setShowComponent] = useState(false);
  const [componentCount, setComponentCount] = useState(1);

  return (
    <div style={{ padding: "20px", border: "1px solid #ccc", margin: "10px" }}>
      <h2>Lifecycle Logger</h2>
      <p>
        This example uses <code>onMount</code> and <code>onUnmount</code>{" "}
        callbacks to log lifecycle events. Check the console!
      </p>
      <div style={{ marginTop: "10px" }}>
        <button onClick={() => setShowComponent(!showComponent)}>
          {showComponent ? "Hide Component" : "Show Component"}
        </button>
        <button
          onClick={() => {
            setShowComponent(false);
            setTimeout(() => {
              setComponentCount((c) => c + 1);
              setShowComponent(true);
            }, 100);
          }}
          style={{ marginLeft: "10px" }}
        >
          Remount Component
        </button>
      </div>
      <div style={{ marginTop: "10px" }}>
        {showComponent && <ComponentWithLifecycle id={componentCount} />}
      </div>
      <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
        💡 Open the browser console to see mount/unmount logs and cleanup
        actions.
      </p>
    </div>
  );
};
