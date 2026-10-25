import { useDebouncedCallback } from "@altalyst/hookify";
import { useState } from "react";

const Editor = () => {
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState({ text: "", count: 0 });

  const save = useDebouncedCallback(
    (text: string) => {
      console.log(`Saved draft: "${text}"`);
      setSaved((prev) => ({ text, count: prev.count + 1 }));
    },
    1500,
    { flushOnUnmount: true }
  );

  return (
    <>
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          save(e.target.value);
        }}
        onBlur={save.flush}
        placeholder="Type a draft..."
      />
      <p>
        Saved {saved.count} time(s): {saved.text || "nothing yet"}
      </p>
      <p>Status: {save.isPending() ? "unsaved changes" : "up to date"}</p>
    </>
  );
};

export const Autosave = () => {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <h2>Autosave (flushOnUnmount)</h2>
      <p>
        Saves 1.5s after you stop typing, on blur, and when the editor is
        closed. Open the console to see each save.
      </p>
      <button onClick={() => setOpen((value) => !value)}>
        {open ? "Close editor" : "Open editor"}
      </button>
      {open && <Editor />}
    </div>
  );
};
