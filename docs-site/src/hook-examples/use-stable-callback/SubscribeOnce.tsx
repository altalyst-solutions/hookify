import { useStableCallback } from "@altalyst/hookify";
import { useEffect, useState } from "react";

export const SubscribeOnce = () => {
  const [step, setStep] = useState(1);
  const [total, setTotal] = useState(0);

  const onTick = useStableCallback(() => {
    console.log(`Adding ${step}`);
    setTotal((value) => value + step);
  });

  useEffect(() => {
    console.log("Timer started");
    const id = setInterval(onTick, 1000);
    return () => clearInterval(id);
  }, [onTick]);

  return (
    <div>
      <h2>Subscribe once</h2>
      <p>
        Total: {total} (adds {step} every second)
      </p>
      <button onClick={() => setStep((value) => value + 1)}>
        Increase step
      </button>
      <p>
        Change the step and watch the <strong>Console</strong>: "Timer started"
        is not logged again (React may log it twice on mount in development),
        yet each tick uses the latest step.
      </p>
    </div>
  );
};
