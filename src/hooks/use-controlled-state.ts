import { useCallback, useEffect, useRef, useState } from "react";
import { warnInDevelopment } from "../utils";

/**
 * Props type for components using controlled state pattern.
 *
 * @template T - The type of the state value.
 */
export type UseControlledStateProps<T> = {
  /** The controlled value from parent component. When provided, the component operates in controlled mode. */
  value?: T;
  /** The initial/default value when in uncontrolled mode. */
  defaultValue: T;
  /** Callback invoked when the value changes. */
  onChange?: (value: T) => void;
};

/**
 * Checks if a value indicates controlled mode (not undefined).
 *
 * This helper function determines whether a component should operate in controlled mode
 * by checking if the provided value is defined. In controlled mode, the parent component
 * manages the state. In uncontrolled mode (when value is undefined), the component
 * manages its own internal state.
 *
 * @param {unknown} value - The value to check for controlled mode indication.
 * @returns {boolean} True if the value is defined (controlled mode), false if undefined (uncontrolled mode).
 */
const isValueControlled = (value: unknown): boolean => value !== undefined;

/**
 * A custom React hook that implements the controlled/uncontrolled component pattern.
 *
 * This hook allows components to work in two modes:
 * - **Controlled mode**: When `value` is provided, the parent component manages the state
 * - **Uncontrolled mode**: When `value` is undefined, the hook manages state internally
 *
 * This pattern provides flexibility for component consumers, allowing them to choose
 * between full control of the state or letting the component manage it automatically.
 *
 * The `setValue` function is optimized for performance with a stable reference that only
 * changes when the component switches between controlled/uncontrolled modes or when the
 * `onChange` callback changes. This prevents unnecessary re-renders in child components.
 *
 * In development mode, the hook will warn if a component switches between controlled
 * and uncontrolled modes, which is considered an anti-pattern and can lead to
 * unexpected behavior.
 *
 * @template T - The type of the state value.
 * @param {T | undefined} value - The controlled value. When provided, the hook operates in controlled mode.
 * @param {T | (() => T)} defaultValue - The initial value for uncontrolled mode. Can be a value or lazy initializer function.
 * @param {(value: T) => void} [onChange] - Optional callback invoked whenever the value changes.
 * @returns {readonly [T, (newValue: T | ((prev: T) => T)) => void]} A tuple containing the current value and a stable setter function that accepts either a new value or an updater function.
 *
 * @example
 * ```typescript
 * // Uncontrolled usage - component manages its own state
 * function UncontrolledInput() {
 *   const [value, setValue] = useControlledState(undefined, "", console.log);
 *   return <input value={value} onChange={(e) => setValue(e.target.value)} />;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Controlled usage - parent manages the state
 * function ControlledInput({ value, onChange }) {
 *   const [inputValue, setInputValue] = useControlledState(value, "", onChange);
 *   return <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} />;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With updater function for complex state updates
 * const [count, setCount] = useControlledState(undefined, 0);
 * setCount(prev => prev + 1);
 * ```
 *
 * @example
 * ```typescript
 * // With lazy initialization for expensive defaults
 * const [data, setData] = useControlledState(
 *   undefined,
 *   () => expensiveComputation()
 * );
 * ```
 */
export const useControlledState = <T>(
  value: T | undefined,
  defaultValue: T | (() => T),
  onChange?: (value: T) => void
): readonly [T, (newValue: T | ((prev: T) => T)) => void] => {
  /**
   * Internal state used when the component is operating in uncontrolled mode.
   * Initialized with the `defaultValue` and managed internally by the hook.
   */
  const [internalValue, setInternalValue] = useState<T>(defaultValue);

  /**
   * A ref that tracks whether the component was initially in controlled mode.
   * Used to detect transitions between controlled and uncontrolled modes,
   * which is an anti-pattern that triggers development warnings.
   */
  const wasControlledRef = useRef(isValueControlled(value));

  /**
   * Determines the current mode based on whether `value` is defined.
   * True if controlled (value provided), false if uncontrolled (value undefined).
   */
  const isControlled = isValueControlled(value);

  /**
   * The actual current value returned to the component.
   * In controlled mode, uses the provided `value`.
   * In uncontrolled mode, uses the internal state.
   */
  const currentValue = isControlled ? (value as T) : internalValue;

  /**
   * A ref that stores the current value to prevent stale closures in the setValue callback.
   * This ensures that updater functions always have access to the latest value
   * without requiring `currentValue` to be in the dependency array.
   */
  const currentValueRef = useRef(currentValue);
  currentValueRef.current = currentValue;

  // Warn in development if switching between controlled/uncontrolled modes
  useEffect(() => {
    const isControlledNow = isValueControlled(value);

    // Detect and warn about mode switching (anti-pattern)
    if (wasControlledRef.current !== isControlledNow) {
      warnInDevelopment(
        `useControlledState: Component is changing from ${
          wasControlledRef.current ? "controlled" : "uncontrolled"
        } to ${isControlledNow ? "controlled" : "uncontrolled"} mode. ` +
          "This is an anti-pattern and may cause unexpected behavior."
      );
    }

    // Update the controlled mode tracking
    wasControlledRef.current = isControlledNow;
  }, [value]);

  // Memoized setter function that handles both direct values and updater functions
  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      // Resolve updater function to get the actual value (supports prev => prev + 1 pattern)
      const resolvedValue =
        typeof newValue === "function"
          ? (newValue as (prev: T) => T)(currentValueRef.current)
          : newValue;

      // Update internal state only in uncontrolled mode (controlled mode ignores this)
      if (!isValueControlled(value)) {
        setInternalValue(resolvedValue);
      }

      // Always notify parent of value changes via onChange callback
      onChange?.(resolvedValue);
    },
    [onChange, value]
  );

  return [currentValue, setValue] as const;
};
