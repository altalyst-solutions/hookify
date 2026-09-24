import { SearchInput } from "./SearchInput";
import { WindowResize } from "./WindowResize";
import { DebouncedButton } from "./DebouncedButton";

export default function App() {
  return (
    <>
      <SearchInput />
      <WindowResize />
      <DebouncedButton />
    </>
  );
}
