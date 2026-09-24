import { useOutsideClick } from "@altalyst/hookify";
import type { MouseEvent, RefObject } from "react";
import { useRef, useState } from "react";

import "./styles.css";

export default function App() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleToggleDropdown = (event: MouseEvent) => {
    event.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const handleOutsideClick = () => {
    setIsOpen(false);
  };

  useOutsideClick(dropdownRef as RefObject<HTMLElement>, handleOutsideClick);

  return (
    <div className="component__container">
      <button className="component__button" onClick={handleToggleDropdown}>
        Toggle Dropdown
      </button>

      {isOpen && (
        <div ref={dropdownRef} className="component__dropdown">
          <p>Dropdown Content</p>
          <p>Click outside to close me!</p>
        </div>
      )}
    </div>
  );
}
