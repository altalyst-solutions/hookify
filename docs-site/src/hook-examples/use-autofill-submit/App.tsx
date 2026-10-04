import { useAutofillSubmit } from "@altalyst/hookify";
import type { SubmitEvent } from "react";
import { useRef, useState } from "react";

import "./styles.css";

export default function App() {
  const formRef = useRef<HTMLFormElement>(null);
  const [log, setLog] = useState<string[]>([]);
  const { rearm } = useAutofillSubmit(formRef, {
    fields: ["email", "password"],
    // Veto the auto-submit unless the email looks valid.
    onAutofill: ({ values }) => values.email.includes("@"),
  });

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setLog((prev) => [...prev, `Signed in as ${String(data.get("email"))}`]);
    // Pretend the attempt failed so the next fill may submit again.
    rearm();
  };

  // A real password manager writes to fields the user is not focused on.
  const simulateFill = () => {
    const form = formRef.current;
    if (!form) return;
    (form.elements.namedItem("email") as HTMLInputElement).value =
      `user${log.length}@example.com`;
    (form.elements.namedItem("password") as HTMLInputElement).value =
      "correct horse";
  };

  return (
    <div className="component__container">
      <form ref={formRef} onSubmit={handleSubmit} className="component__form">
        <input name="email" placeholder="Email" autoComplete="username" />
        <input
          name="password"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
        />
        <button type="submit">Sign in</button>
      </form>

      <p>
        Click or type in the form first (a gesture is required), then simulate a
        password manager:
      </p>
      <button type="button" onClick={simulateFill}>
        Simulate password manager fill
      </button>

      <ul>
        {log.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ul>
    </div>
  );
}
