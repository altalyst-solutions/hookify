import { useCallback, useState } from "react";

/**
 * A custom React hook for toggling a boolean state.
 *
 * This hook is useful for managing binary states, such as showing/hiding elements, toggling themes, or activating/deactivating features.
 *
 * @param {boolean} [initialState=false] - The initial state of the toggle (default is `false`).
 * @returns {[boolean, () => void]} - An array containing the current state and a function to toggle it.
 *
 * @example
 * ```typescript
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
 * For a complete example, see [examples/useToggleState.ts](../../examples/basic/src/components/use-toggle-state/index.tsx).
 */
export const useToggleState = (
  initialState: boolean = false
): [boolean, () => void] => {
  const [state, setState] = useState(initialState);

  /**
   * Toggles the current state between `true` and `false`.
   */
  const toggle = useCallback(() => {
    setState((prev) => !prev);
  }, []);

  return [state, toggle] as const;
};
