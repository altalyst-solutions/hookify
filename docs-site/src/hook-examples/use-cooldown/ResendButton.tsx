import { useCooldown } from "@altalyst/hookify";
import { useState } from "react";

export const ResendButton = () => {
  const [sent, setSent] = useState(0);
  const { remaining, isActive, start } = useCooldown(10, {
    onComplete: () => console.log("Cooldown finished, resend is available"),
  });

  const resend = () => {
    setSent((n) => n + 1);
    start();
  };

  return (
    <div>
      <h2>Resend email (10s cooldown)</h2>
      <p>Emails sent: {sent}</p>
      <button onClick={resend} disabled={isActive}>
        {isActive ? `Resend in ${remaining}s` : "Resend email"}
      </button>
    </div>
  );
};
