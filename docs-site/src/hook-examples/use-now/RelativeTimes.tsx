import { useNow } from "@altalyst/hookify";
import { useState } from "react";

const formatAgo = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
};

// Every label calls `useNow` with the same interval, so they share one timer.
const TimeAgo = ({ at }: { at: number }) => {
  const now = useNow({ intervalMs: 1000 });
  return <span>{formatAgo(now - at)}</span>;
};

export const RelativeTimes = () => {
  const [posts, setPosts] = useState<{ id: number; at: number }[]>([
    { id: 1, at: Date.now() - 45_000 },
    { id: 2, at: Date.now() - 3 * 60_000 },
  ]);

  const addPost = () =>
    setPosts((list) => [{ id: list.length + 1, at: Date.now() }, ...list]);

  return (
    <div>
      <h2>Relative timestamps (one shared timer)</h2>
      <p>
        {posts.length} labels, still a single <code>setInterval</code>.
      </p>
      <button onClick={addPost}>Add a post</button>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            Post #{post.id}: <TimeAgo at={post.at} />
          </li>
        ))}
      </ul>
    </div>
  );
};
