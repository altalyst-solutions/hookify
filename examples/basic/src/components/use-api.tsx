import { useApi } from "@altalyst/hookify";

interface IUser {
  id: number;
  name: string;
  email: string;
}

export const UseApi = () => {
  const API_URL = "https://jsonplaceholder.typicode.com/users";

  const { data, loading, error, refetch } = useApi<IUser[]>(API_URL);

  if (loading) {
    return <div>Loading users...</div>;
  }

  if (error) {
    return (
      <div>
        <p>Error fetching users: {error}</p>
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <h1>User List</h1>
      <button onClick={refetch}>Refresh Users</button>
      <ul>
        {data?.map((user) => (
          <li key={user.id}>
            {user.name} - {user.email}
          </li>
        ))}
      </ul>
    </div>
  );
};
