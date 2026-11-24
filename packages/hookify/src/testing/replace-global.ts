/**
 * Replaces a property of an object and returns a function that undoes it.
 *
 * It saves the object's own property descriptor, not just the value, so a
 * property that was only inherited (such as `document.visibilityState`, which
 * lives on the prototype) or that didn't exist (such as `IntersectionObserver`
 * in jsdom) is deleted again on restore instead of being left behind as an own
 * property.
 *
 * @param target - The object to change.
 * @param name - The name of the property.
 * @param descriptor - The new descriptor. `configurable` is always set, so the
 * property can be replaced again or removed.
 * @returns A function that restores the previous state. Calling it more than
 * once does nothing.
 */
export const replaceProperty = (
  target: object,
  name: string,
  descriptor: PropertyDescriptor
): (() => void) => {
  const previous = Object.getOwnPropertyDescriptor(target, name);
  /** Whether this replacement has already been undone. */
  let restored = false;

  Object.defineProperty(target, name, { ...descriptor, configurable: true });

  return () => {
    if (restored) return;
    restored = true;

    if (previous) {
      Object.defineProperty(target, name, previous);
    } else {
      delete (target as Record<string, unknown>)[name];
    }
  };
};

/**
 * Replaces a global with a fake and returns a function that undoes it.
 *
 * @param name - The name of the global, such as `"IntersectionObserver"`.
 * @param value - The fake to put in its place.
 * @returns A function that restores the previous state, or removes the global
 * if there was none. Calling it more than once does nothing.
 */
export const replaceGlobal = (name: string, value: unknown): (() => void) =>
  replaceProperty(globalThis, name, { writable: true, value });
