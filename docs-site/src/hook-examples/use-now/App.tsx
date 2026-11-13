import { Countdown } from "./Countdown";
import { LiveClock } from "./LiveClock";
import { RelativeTimes } from "./RelativeTimes";
import { Stopwatch } from "./Stopwatch";

export default function App() {
  return (
    <>
      <LiveClock />
      <RelativeTimes />
      <Stopwatch />
      <Countdown />
    </>
  );
}
