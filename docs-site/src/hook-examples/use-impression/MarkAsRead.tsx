import { useImpression } from "@altalyst/hookify";
import { useState } from "react";

interface Message {
  id: number;
  text: string;
  read: boolean;
}

const Row = ({
  message,
  root,
  onRead,
}: {
  message: Message;
  root: HTMLElement | null;
  onRead: (id: number) => void;
}) => {
  // Stop tracking as soon as the message is read.
  const ref = useImpression<HTMLLIElement>(() => onRead(message.id), {
    root,
    threshold: 0.8,
    minDurationMs: 1500,
    enabled: !message.read,
  });

  return (
    <li
      ref={ref}
      style={{
        height: 60,
        marginBottom: 40,
        padding: 8,
        border: "1px solid",
        borderRadius: 4,
        fontWeight: message.read ? "normal" : "bold",
        opacity: message.read ? 0.6 : 1,
      }}
    >
      {message.read ? "✓ " : "● "}
      {message.text}
    </li>
  );
};

const initialMessages = (): Message[] =>
  ["Welcome aboard", "Your invoice", "New comment", "Weekly digest"].map(
    (text, i) => ({ id: i, text, read: false })
  );

export const MarkAsRead = () => {
  const [root, setRoot] = useState<HTMLUListElement | null>(null);
  const [messages, setMessages] = useState(initialMessages);

  const markRead = (id: number) =>
    setMessages((list) =>
      list.map((m) => (m.id === id ? { ...m, read: true } : m))
    );

  const unread = messages.filter((m) => !m.read).length;

  return (
    <div>
      <h2>Mark as read</h2>
      <p>
        A message is marked read after it was 80% visible for 1.5 seconds, and
        then it stops being tracked (<code>enabled: !read</code>). Unread:{" "}
        {unread}.
      </p>
      <ul
        ref={setRoot}
        style={{
          height: 160,
          margin: 0,
          padding: 8,
          overflowY: "auto",
          listStyle: "none",
          border: "1px solid",
          borderRadius: 4,
        }}
      >
        {messages.map((message) => (
          <Row
            key={message.id}
            message={message}
            root={root}
            onRead={markRead}
          />
        ))}
      </ul>
      <button onClick={() => setMessages(initialMessages)}>
        Mark all unread
      </button>
    </div>
  );
};
