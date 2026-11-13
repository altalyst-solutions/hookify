import { BurstLimit } from "./BurstLimit";
import { EventQueue } from "./EventQueue";
import { SlowDownHint } from "./SlowDownHint";

export default function App() {
  return (
    <>
      <BurstLimit />
      <EventQueue />
      <SlowDownHint />
    </>
  );
}
