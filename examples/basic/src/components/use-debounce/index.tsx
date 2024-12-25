import { DebouncedButton } from "./components/debounced-button";
import { SearchInput } from "./components/search-input";
import { WindowResize } from "./components/window-resize";

export const UseDebounce = () => {
  return (
    <>
      <SearchInput />
      <WindowResize />
      <DebouncedButton />
    </>
  );
};
