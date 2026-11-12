import { SkipIfBusy } from "./SkipIfBusy";
import { Worker } from "./Worker";

export default function App() {
  return (
    <>
      <h2>Exclusive lock</h2>
      <p>
        Both workers ask for the same lock, so they take turns. Open this page
        in a second tab and they take turns across tabs too.
      </p>
      <Worker name="Worker A" />
      <Worker name="Worker B" />
      <SkipIfBusy />
    </>
  );
}
