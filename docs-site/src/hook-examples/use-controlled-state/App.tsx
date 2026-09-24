import { ControlledInput } from "./ControlledInput";
import { CounterWithUpdater } from "./CounterWithUpdater";
import { CustomSelectDemo } from "./CustomSelect";
import { UncontrolledInput } from "./UncontrolledInput";

export default function App() {
  return (
    <>
      <UncontrolledInput />
      <ControlledInput />
      <CounterWithUpdater />
      <CustomSelectDemo />
    </>
  );
}
