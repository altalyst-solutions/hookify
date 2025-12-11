import { AsyncDataFetcher } from "./components/async-data-fetcher";
import { LifecycleLogger } from "./components/lifecycle-logger";
import { TimerComponent } from "./components/timer-component";

export const UseMounted = () => {
  return (
    <>
      <AsyncDataFetcher />
      <LifecycleLogger />
      <TimerComponent />
    </>
  );
};
