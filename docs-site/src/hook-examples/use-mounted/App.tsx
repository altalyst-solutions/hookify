import { AsyncDataFetcher } from "./AsyncDataFetcher";
import { LifecycleLogger } from "./LifecycleLogger";
import { TimerComponent } from "./TimerComponent";

export default function App() {
  return (
    <>
      <AsyncDataFetcher />
      <LifecycleLogger />
      <TimerComponent />
    </>
  );
}
