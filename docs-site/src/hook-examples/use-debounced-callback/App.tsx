import { Autosave } from "./Autosave";
import { ClickGuard } from "./ClickGuard";
import { SearchInput } from "./SearchInput";

export default function App() {
  return (
    <>
      <SearchInput />
      <Autosave />
      <ClickGuard />
    </>
  );
}
