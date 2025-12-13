import { ApiPoller } from "./components/api-poller";
import { CountdownTimer } from "./components/countdown-timer";
import { EngagementTracker } from "./components/engagement-tracker";
import { VideoPlayer } from "./components/video-player";

export const UseDocVisible = () => {
  return (
    <>
      <VideoPlayer />
      <ApiPoller />
      <CountdownTimer />
      <EngagementTracker />
    </>
  );
};
