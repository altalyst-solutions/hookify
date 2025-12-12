import { ControlledInput } from "./components/controlled-input";
import { CounterWithUpdater } from "./components/counter-with-updater";
import { CustomSelectDemo } from "./components/custom-select";
import { UncontrolledInput } from "./components/uncontrolled-input";

export const UseControlledState = () => {
  return (
    <>
      <UncontrolledInput />
      <ControlledInput />
      <CounterWithUpdater />
      <CustomSelectDemo />
    </>
  );
};
