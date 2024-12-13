import { useOutsideClick } from "@altalyst/hookify";
import type { MouseEvent } from "react";
import { useRef, useState } from "react";

import "./styles.scss";

export const UseOutsideClick = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleToggleDropdown = (event: MouseEvent) => {
    event.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const handleOutsideClick = () => {
    setIsOpen(false);
  };

  useOutsideClick(dropdownRef, handleOutsideClick);

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
};
