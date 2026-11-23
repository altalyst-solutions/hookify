/**
 * Replaces a global with a fake and returns a function that undoes it.
 *
 * It saves the property descriptor, not just the value, so a global that
 * didn't exist before (as `IntersectionObserver` doesn't in jsdom) is deleted
 * again on restore instead of being left behind as `undefined`.
 *
 * @param name - The name of the global, such as `"IntersectionObserver"`.
 * @param value - The fake to put in its place.
 * @returns A function that restores the previous state. Calling it more than
 * once does nothing.
 */
export const replaceGlobal = (name: string, value: unknown): (() => void) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  /** Whether this replacement has already been undone. */
  let restored = false;

  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });

  return () => {
    if (restored) return;
    restored = true;

    if (previous) {
      Object.defineProperty(globalThis, name, previous);
    } else {
      delete (globalThis as Record<string, unknown>)[name];
    }
  };
};
