import { VideoPlayer } from "./VideoPlayer";
import { ApiPoller } from "./ApiPoller";
import { CountdownTimer } from "./CountdownTimer";
import { EngagementTracker } from "./EngagementTracker";

export default function App() {
  return (
    <>
      <VideoPlayer />
      <ApiPoller />
      <CountdownTimer />
      <EngagementTracker />
    </>
  );
}
