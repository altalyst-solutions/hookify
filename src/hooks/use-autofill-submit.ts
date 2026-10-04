import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

/** A form control whose value can be filled by a password manager. */
export type AutofillField =
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Current value of every watched field, keyed by its `name`. */
export type AutofillValues<TName extends string> = Readonly<
  Record<TName, string>
>;

/** Details handed to {@link UseAutofillSubmitOptions.onAutofill} and `submit`. */
export interface AutofillContext<TName extends string> {
  /** The form being watched. */
  form: HTMLFormElement;
  /** Value of every watched field at the moment the fill was detected. */
  values: AutofillValues<TName>;
  /** Names of the fields whose value changed while they were not focused. */
  filled: readonly TName[];
}

/** Options for {@link useAutofillSubmit}. */
export interface UseAutofillSubmitOptions<TName extends string> {
  /**
   * `name` of every field that must be filled before submitting. All of them
   * must satisfy {@link UseAutofillSubmitOptions.isFilled}, so a manager that
   * fills only the password on a blank email stays quiet. Inline array
   * literals are fine; only the names' contents matter.
   */
  fields: readonly TName[];
  /** Turn the watcher off without unmounting. Defaults to `true`. */
  enabled?: boolean;
  /** How often, in milliseconds, field values are sampled. Defaults to `250`. */
  pollInterval?: number;
  /**
   * Events on the form that count as the user being present. Defaults to
   * `keydown`, `pointerdown` and `touchstart`.
   */
  interactionEvents?: readonly (keyof HTMLElementEventMap)[];
  /**
   * Require one of {@link UseAutofillSubmitOptions.interactionEvents} before
   * anything auto-submits, so credentials restored on page load can never sign
   * someone straight back in. Defaults to `true`.
   */
  requireInteraction?: boolean;
  /** Decide whether a field counts as filled. Defaults to a non-empty value. */
  isFilled?: (value: string, name: TName, element: AutofillField) => boolean;
  /**
   * Called when a complete fill is detected, right before submitting. Return
   * `false` to veto it; the hook stays armed and tries again on the next fill.
   */
  onAutofill?: (context: AutofillContext<TName>) => boolean | void;
  /**
   * Replace how the form is submitted. Defaults to `form.requestSubmit()`
   * (after `reportValidity()`), which takes the form's own `onSubmit` path.
   */
  submit?: (context: AutofillContext<TName>) => void;
}

/** Imperative controls returned by {@link useAutofillSubmit}. */
export interface UseAutofillSubmitResult {
  /** Allow another auto-submit, e.g. after a failed sign-in attempt. */
  rearm: () => void;
  /** Stop auto-submitting until {@link UseAutofillSubmitResult.rearm}. */
  disarm: () => void;
  /** Whether the next fill is still allowed to submit. */
  isArmed: () => boolean;
}

/** Default sampling interval; cheap enough (a few string reads) to poll. */
const DEFAULT_POLL_INTERVAL_MS = 250;
/** Gestures that establish the user is present before anything submits. */
const DEFAULT_INTERACTION_EVENTS = [
  "keydown",
  "pointerdown",
  "touchstart",
] as const satisfies readonly (keyof HTMLElementEventMap)[];

/** Narrows an unknown value to a form control the hook can watch. */
const isField = (element: unknown): element is AutofillField =>
  element instanceof HTMLInputElement ||
  element instanceof HTMLSelectElement ||
  element instanceof HTMLTextAreaElement;

/** Compares two arrays item by item with `===`. */
const isShallowEqual = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

/**
 * Returns the previously seen array while its items are unchanged, so inline
 * array literals do not change identity (and re-run effects) every render.
 */
const useStableArray = <T>(next: readonly T[]): readonly T[] => {
  // State instead of a ref: refs must not be read during render.
  const [stable, setStable] = useState(next);
  if (!isShallowEqual(stable, next)) {
    setStable(next);
    return next;
  }
  return stable;
};

/**
 * Submits a form as soon as a password manager fills it, so choosing a saved
 * login is all it takes to sign in.
 *
 * A fill is told apart from typing by where the keyboard focus was: a field
 * whose value changed while it was *not* the focused element was written by
 * something other than the user's hands. Pasting into the focused field is
 * deliberately not treated as a fill. Values are sampled on an interval,
 * because some providers (notably iOS AutoFill) write to fields without any
 * event a page can rely on.
 *
 * Safeguards keep it from firing when the user has not asked for it:
 *
 * - A real gesture must reach the form first (see `requireInteraction`).
 * - It arms once. Any submit, this one included, disarms it, so a fill racing
 *   a tap on the button cannot send the credentials twice. Call `rearm()` (or
 *   reset the form) to allow another attempt, e.g. after a failed sign-in.
 *
 * Fields are looked up by `name` on every sample, so conditionally rendered
 * fields work. A name that matches nothing, or a radio group, pauses
 * detection until it resolves to a single input, select or textarea. The form
 * ref must already be populated when the hook's effect runs.
 *
 * The default submit uses `requestSubmit()` (iOS 16+); on older browsers it
 * falls back to dispatching a cancelable `submit` event and then
 * `form.submit()`.
 *
 * @param formRef - Ref to the `<form>` to watch and submit.
 * @param options - See {@link UseAutofillSubmitOptions}.
 * @returns Imperative `rearm`, `disarm` and `isArmed` controls.
 *
 * @example
 * ```tsx
 * const formRef = useRef<HTMLFormElement>(null);
 * const { rearm } = useAutofillSubmit(formRef, {
 *   fields: ["email", "password"],
 *   onAutofill: ({ values }) => values.email.includes("@"),
 * });
 *
 * return (
 *   <form ref={formRef} onSubmit={handleSubmit}>
 *     <input name="email" autoComplete="username" />
 *     <input name="password" type="password" autoComplete="current-password" />
 *     <button>Sign in</button>
 *   </form>
 * );
 * ```
 *
 * For a live, editable example, see the [useAutofillSubmit docs page](https://altalyst-solutions.github.io/hookify/hooks/use-autofill-submit).
 */
export const useAutofillSubmit = <const TName extends string>(
  formRef: RefObject<HTMLFormElement | null>,
  options: UseAutofillSubmitOptions<TName>
): UseAutofillSubmitResult => {
  const {
    enabled = true,
    pollInterval = DEFAULT_POLL_INTERVAL_MS,
    requireInteraction = true,
  } = options;
  const fields = useStableArray(options.fields);
  const interactionEvents = useStableArray<keyof HTMLElementEventMap>(
    options.interactionEvents ?? DEFAULT_INTERACTION_EVENTS
  );

  // Latest options, read at sample time so callbacks never need stable identity.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  // Whether the next fill may submit. A ref: it must not cause re-renders.
  const armedRef = useRef(true);
  const rearm = useCallback(() => {
    armedRef.current = true;
  }, []);
  const disarm = useCallback(() => {
    armedRef.current = false;
  }, []);
  const isArmed = useCallback(() => armedRef.current, []);

  useEffect(() => {
    const form = formRef.current;
    if (!enabled || !form) return;

    // Whether a real gesture has reached the form since the effect started.
    let hasInteracted = false;
    // Last sampled value per field; the baseline a fill is detected against.
    let previous: Partial<Record<TName, string>> = {};

    /** Looks a field up by name; null if missing or not a single control. */
    const resolve = (name: TName) => {
      const element = form.elements.namedItem(name);
      return isField(element) ? element : null;
    };
    /** Whether the element currently holds keyboard focus. */
    const isFocused = (element: Element) =>
      element === form.ownerDocument.activeElement;
    /** Records every resolvable field's current value as the baseline. */
    const baseline = () => {
      previous = {};
      for (const name of fields) {
        const element = resolve(name);
        if (element) previous[name] = element.value;
      }
    };
    baseline();

    /** Marks that the user is present. */
    const noteInteraction = () => {
      hasInteracted = true;
    };
    /** Re-baselines the focused field after typing or pasting. */
    const noteInput = (event: Event) => {
      const { target } = event;
      if (!isField(target) || !isFocused(target)) return;
      // Only the focused field is baselined: a fill writes to the field the
      // user is *not* in, and some providers dispatch input events for it.
      const name = fields.find((candidate) => resolve(candidate) === target);
      if (name !== undefined) previous[name] = target.value;
    };
    /** Any submit, ours included, disarms the hook. */
    const handleSubmit = () => {
      armedRef.current = false;
    };
    /** Resetting the form is a fresh start: re-arm and re-baseline. */
    const handleReset = () => {
      armedRef.current = true;
      // Values are only restored after this event, so re-baseline on the next
      // sample rather than reading the pre-reset ones.
      previous = {};
    };

    for (const type of interactionEvents) {
      form.addEventListener(type, noteInteraction);
    }
    form.addEventListener("input", noteInput);
    form.addEventListener("submit", handleSubmit);
    form.addEventListener("reset", handleReset);

    /**
     * One sample: detects a fill, and submits when every field is complete.
     * Baselines are refreshed on every call so a handled change is never read
     * as a new fill.
     */
    const tick = () => {
      const elements = new Map<TName, AutofillField>();
      for (const name of fields) {
        const element = resolve(name);
        if (!element) return;
        elements.set(name, element);
      }

      const values = {} as Record<TName, string>;
      const filled: TName[] = [];
      for (const [name, element] of elements) {
        values[name] = element.value;
        const before = previous[name];
        if (
          before !== undefined &&
          before !== element.value &&
          !isFocused(element)
        ) {
          filled.push(name);
        }
      }
      // Sampled unconditionally, so a change already accounted for can never
      // be read as a fresh fill on a later tick.
      previous = { ...values };

      if (!armedRef.current || filled.length === 0) return;
      if (requireInteraction && !hasInteracted) return;

      const { isFilled, onAutofill, submit } = optionsRef.current;
      const isComplete = [...elements].every(([name, element]) =>
        isFilled ? isFilled(values[name], name, element) : values[name] !== ""
      );
      if (!isComplete) return;

      const context: AutofillContext<TName> = { form, values, filled };
      if (onAutofill?.(context) === false) return;

      armedRef.current = false;
      if (submit) {
        submit(context);
      } else if (form.reportValidity()) {
        if (typeof form.requestSubmit === "function") {
          form.requestSubmit();
        } else if (
          form.dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true })
          )
        ) {
          form.submit();
        }
      }
    };

    const timer = window.setInterval(tick, pollInterval);

    return () => {
      window.clearInterval(timer);
      form.removeEventListener("input", noteInput);
      form.removeEventListener("submit", handleSubmit);
      form.removeEventListener("reset", handleReset);
      for (const type of interactionEvents) {
        form.removeEventListener(type, noteInteraction);
      }
    };
  }, [
    enabled,
    fields,
    formRef,
    interactionEvents,
    pollInterval,
    requireInteraction,
  ]);

  return { rearm, disarm, isArmed };
};
