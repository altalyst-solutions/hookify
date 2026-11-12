import { useTabLeader } from "@altalyst/hookify";

export const Tab = ({
  name,
  onClose,
}: {
  name: string;
  onClose: () => void;
}) => {
  const { isLeader, leaderId, id } = useTabLeader("hookify-demo-leader", {
    onElected: () => console.log(`${name} is now the leader`),
    onDemoted: () => console.log(`${name} is no longer the leader`),
  });

  return (
    <p>
      <strong>{name}</strong>: {isLeader ? "LEADER" : "follower"}{" "}
      <small>
        (id {id?.slice(0, 4) ?? "..."}, leader {leaderId?.slice(0, 4) ?? "?"})
      </small>{" "}
      <button onClick={onClose}>Close</button>
    </p>
  );
};
