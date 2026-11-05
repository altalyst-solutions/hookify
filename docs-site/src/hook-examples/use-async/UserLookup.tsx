import { useAsync } from "@altalyst/hookify";
import { useState } from "react";

interface IUser {
  id: number;
  name: string;
}

const USERS: Record<number, IUser> = {
  1: { id: 1, name: "Ada Lovelace" },
  2: { id: 2, name: "Grace Hopper" },
};

// Simulated API call: waits a moment, then resolves or rejects.
const fetchUser = (id: number) =>
  new Promise<IUser>((resolve, reject) => {
    setTimeout(() => {
      const user = USERS[id];
      if (user) resolve(user);
      else reject(new Error(`User ${id} not found`));
    }, 800);
  });

export const UserLookup = () => {
  const [id, setId] = useState(1);

  // `run` forwards its arguments to `fetchUser`. Click quickly to see that
  // only the latest call updates the state.
  const { run, data, error, status, isPending, reset } = useAsync<
    IUser,
    [number],
    Error
  >(fetchUser, {
    onError: (err, [requestedId]) =>
      console.log(`Lookup of ${requestedId} failed: ${err.message}`),
  });

  return (
    <div>
      <h2>Look up a user</h2>
      <label>
        User id{" "}
        <input
          type="number"
          value={id}
          onChange={(e) => setId(Number(e.target.value))}
        />
      </label>{" "}
      <button onClick={() => run(id)} disabled={isPending}>
        {isPending ? "Loading..." : "Load"}
      </button>{" "}
      <button onClick={reset} disabled={status === "idle"}>
        Reset
      </button>
      <p>Status: {status}</p>
      {data && <p>Last loaded: {data.name}</p>}
      {error && <p style={{ color: "crimson" }}>{error.message}</p>}
      <p>Try id 1 or 2, then an unknown id such as 7.</p>
    </div>
  );
};
