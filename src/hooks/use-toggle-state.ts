import type { Dispatch, SetStateAction } from "react";
import { useCallback, useState } from "react";

/**
 * A custom React hook for toggling a boolean state.
 *
 * This hook is useful for managing binary states, such as showing/hiding elements, toggling themes, or activating/deactivating features.
 *
 * @param initialState - The initial state of the toggle (default is `false`).
 * @returns A tuple of the current state, a stable `toggle` function, and a stable `setState` for setting an explicit value (for example `setOpen(false)` to close).
 *
 * @example
 * ```tsx
 * const [isVisible, toggleVisibility] = useToggleState(false);
 *
 * return (
 *   <div>
 *     <button onClick={toggleVisibility}>
 *       {isVisible ? "Hide" : "Show"} Content
 *     </button>
 *     {isVisible && <p>This is some toggleable content!</p>}
 *   </div>
 * );
 * ```
 *
 * @example
 * ```tsx
 * const [isOpen, toggleOpen, setOpen] = useToggleState();
 *
 * return (
 *   <>
 *     <button onClick={toggleOpen}>Menu</button>
 *     {isOpen && <Menu onSelect={() => setOpen(false)} />}
 *   </>
 * );
 * ```
 *
 * For a live, editable example, see the [useToggleState docs page](https://altalyst-solutions.github.io/hookify/hooks/use-toggle-state).
 */
export const useToggleState = (
  initialState: boolean = false
): [boolean, () => void, Dispatch<SetStateAction<boolean>>] => {
  const [state, setState] = useState(initialState);

  /**
   * Toggles the current state between `true` and `false`.
   */
  const toggle = useCallback(() => {
    setState((prev) => !prev);
  }, []);

  return [state, toggle, setState];
};
