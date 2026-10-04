import { act, renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";

import type {
  AutofillContext,
  UseAutofillSubmitOptions,
  UseAutofillSubmitResult,
} from "@/hooks";
import { useAutofillSubmit } from "@/hooks";

const TICK = 250;

let form: HTMLFormElement;
let email: HTMLInputElement;
let password: HTMLInputElement;
let formRef: RefObject<HTMLFormElement>;
let requestSubmit: ReturnType<typeof vi.fn>;

const tick = (times = 1) =>
  act(() => void vi.advanceTimersByTime(TICK * times));
const interact = () => act(() => void form.dispatchEvent(new Event("keydown")));

/** Simulates a password manager writing to a field the user is not in. */
const fill = (el: HTMLInputElement, value: string) => {
  el.value = value;
};

const field = (name: string, tag = "input") => {
  const el = document.createElement(tag);
  el.setAttribute("name", name);
  form.appendChild(el);
  return el;
};

beforeEach(() => {
  form = document.createElement("form");
  email = field("email") as HTMLInputElement;
  password = field("password") as HTMLInputElement;
  document.body.appendChild(form);
  formRef = { current: form };
  requestSubmit = vi.fn();
  form.requestSubmit = requestSubmit as unknown as typeof form.requestSubmit;
});

afterEach(() => {
  form.remove();
});

const setup = (
  options: Partial<UseAutofillSubmitOptions<"email" | "password">> = {}
) =>
  renderHook(() =>
    useAutofillSubmit(formRef, { fields: ["email", "password"], ...options })
  );

describe("useAutofillSubmit", () => {
  describe("detection", () => {
    it("submits when every field is filled while unfocused after a gesture", () => {
      setup();
      interact();
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();

      expect(requestSubmit).toHaveBeenCalledTimes(1);
    });

    it("submits when only one field changes but all are non-empty", () => {
      email.value = "a@b.co";
      setup();
      interact();
      fill(password, "secret");
      tick();

      expect(requestSubmit).toHaveBeenCalledTimes(1);
    });

    it("does not submit while any field is still empty", () => {
      setup();
      interact();
      fill(password, "secret");
      tick();

      expect(requestSubmit).not.toHaveBeenCalled();
    });

    it("does not treat typing in the focused field as a fill", () => {
      password.value = "x";
      email.value = "a@b.co";
      setup();
      interact();
      password.focus();
      password.value = "xy";
      tick();

      expect(requestSubmit).not.toHaveBeenCalled();
    });

    it("baselines the focused field on input so later blur is not a fill", () => {
      email.value = "a@b.co";
      setup();
      interact();
      password.focus();
      password.value = "typed";
      act(
        () => void password.dispatchEvent(new Event("input", { bubbles: true }))
      );
      password.blur();
      tick();

      expect(requestSubmit).not.toHaveBeenCalled();
    });

    it("does not baseline an unfocused field on an input event", () => {
      email.value = "a@b.co";
      setup();
      interact();
      fill(password, "secret");
      act(
        () => void password.dispatchEvent(new Event("input", { bubbles: true }))
      );
      tick();

      expect(requestSubmit).toHaveBeenCalledTimes(1);
    });

    it("ignores input events from unwatched elements", () => {
      const other = field("other") as HTMLInputElement;
      email.value = "a@b.co";
      setup();
      interact();
      other.focus();
      other.value = "x";
      act(
        () => void other.dispatchEvent(new Event("input", { bubbles: true }))
      );
      fill(password, "secret");
      tick();

      expect(requestSubmit).toHaveBeenCalledTimes(1);
    });

    it("ignores input events whose target is not a field", () => {
      setup();
      interact();
      act(() => void form.dispatchEvent(new Event("input")));
      tick();

      expect(requestSubmit).not.toHaveBeenCalled();
    });

    it("does not read a handled change as a new fill on later ticks", () => {
      const onAutofill = vi.fn(() => false);
      setup({ onAutofill });
      interact();
      fill(email, "a@b.co");
      fill(password, "secret");
      tick(3);

      expect(onAutofill).toHaveBeenCalledTimes(1);
    });
  });

  describe("safeguards", () => {
    it("never submits without a prior user gesture", () => {
      setup();
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();

      expect(requestSubmit).not.toHaveBeenCalled();
    });

    it("submits without a gesture when requireInteraction is false", () => {
      setup({ requireInteraction: false });
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();

      expect(requestSubmit).toHaveBeenCalledTimes(1);
    });

    it.each(["keydown", "pointerdown", "touchstart"])(
      "counts %s as a gesture by default",
      (type) => {
        setup();
        act(() => void form.dispatchEvent(new Event(type)));
        fill(email, "a@b.co");
        fill(password, "secret");
        tick();

        expect(requestSubmit).toHaveBeenCalledTimes(1);
      }
    );

    it("submits only once", () => {
      setup();
      interact();
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();
      fill(email, "c@d.co");
      tick(2);

      expect(requestSubmit).toHaveBeenCalledTimes(1);
    });

    it("disarms when the form is submitted by anything else", () => {
      const { result } = setup();
      interact();
      act(() => void form.dispatchEvent(new Event("submit")));
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();

      expect(result.current.isArmed()).toBe(false);
      expect(requestSubmit).not.toHaveBeenCalled();
    });

    it("does not submit an invalid form but still disarms", () => {
      form.reportValidity = vi.fn(() => false);
      const { result } = setup();
      interact();
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();

      expect(requestSubmit).not.toHaveBeenCalled();
      expect(result.current.isArmed()).toBe(false);
    });
  });

  describe("fields", () => {
    it("sits out while a named field does not exist", () => {
      renderHook(() =>
        useAutofillSubmit(formRef, { fields: ["email", "missing"] })
      );
      interact();
      fill(email, "a@b.co");
      tick();

      expect(requestSubmit).not.toHaveBeenCalled();
    });

    it("picks up a field that renders after mount", () => {
      password.remove();
      setup();
      interact();
      fill(email, "a@b.co");
      tick();
      form.appendChild(password);
      tick();
      fill(password, "secret");
      tick();

      expect(requestSubmit).toHaveBeenCalledTimes(1);
    });

    it("ignores names that resolve to a non-field element", () => {
      const radioA = document.createElement("input");
      radioA.type = "radio";
      radioA.name = "choice";
      const radioB = radioA.cloneNode() as HTMLInputElement;
      form.append(radioA, radioB);
      renderHook(() =>
        useAutofillSubmit(formRef, { fields: ["email", "choice"] })
      );
      interact();
      fill(email, "a@b.co");
      tick();

      expect(requestSubmit).not.toHaveBeenCalled();
    });

    it("supports select and textarea fields", () => {
      const select = field("role", "select") as HTMLSelectElement;
      select.add(new Option("none", ""));
      select.add(new Option("admin", "admin"));
      const area = field("note", "textarea") as HTMLTextAreaElement;
      renderHook(() =>
        useAutofillSubmit(formRef, { fields: ["role", "note"] })
      );
      interact();
      select.value = "admin";
      area.value = "hi";
      tick();

      expect(requestSubmit).toHaveBeenCalledTimes(1);
    });

    it("keeps its state when given a new but equal inline array", () => {
      const { rerender } = renderHook(() =>
        useAutofillSubmit(formRef, { fields: ["email", "password"] })
      );
      interact();
      fill(email, "a@b.co");
      rerender();
      fill(password, "secret");
      tick();

      expect(requestSubmit).toHaveBeenCalledTimes(1);
    });

    it("does nothing when the ref is empty", () => {
      renderHook(() =>
        useAutofillSubmit({ current: null }, { fields: ["email", "password"] })
      );
      tick(2);

      expect(requestSubmit).not.toHaveBeenCalled();
    });
  });

  describe("options", () => {
    it("does nothing while disabled and starts when enabled", () => {
      const { rerender } = renderHook(
        ({ enabled }) =>
          useAutofillSubmit(formRef, {
            fields: ["email", "password"],
            enabled,
          }),
        { initialProps: { enabled: false } }
      );
      interact();
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();
      expect(requestSubmit).not.toHaveBeenCalled();

      rerender({ enabled: true });
      interact();
      fill(email, "c@d.co");
      tick();
      expect(requestSubmit).toHaveBeenCalledTimes(1);
    });

    it("respects a custom pollInterval", () => {
      setup({ pollInterval: 1000 });
      interact();
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();
      expect(requestSubmit).not.toHaveBeenCalled();

      act(() => void vi.advanceTimersByTime(750));
      expect(requestSubmit).toHaveBeenCalledTimes(1);
    });

    it("respects custom interactionEvents", () => {
      setup({ interactionEvents: ["click"] });
      interact();
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();
      expect(requestSubmit).not.toHaveBeenCalled();

      act(() => void form.dispatchEvent(new Event("click")));
      fill(email, "c@d.co");
      tick();
      expect(requestSubmit).toHaveBeenCalledTimes(1);
    });

    it("uses a custom isFilled predicate", () => {
      const isFilled = vi.fn((value: string, name: "email" | "password") =>
        name === "email" ? value.includes("@") : value.length >= 8
      );
      setup({ isFilled });
      interact();
      fill(email, "a@b.co");
      fill(password, "short");
      tick();
      expect(requestSubmit).not.toHaveBeenCalled();

      fill(password, "long-enough");
      tick();
      expect(requestSubmit).toHaveBeenCalledTimes(1);
      expect(isFilled).toHaveBeenCalledWith("a@b.co", "email", email);
    });

    it("passes context to onAutofill", () => {
      const onAutofill = vi.fn();
      setup({ onAutofill });
      interact();
      email.value = "a@b.co";
      tick();
      onAutofill.mockClear();
      fill(password, "secret");
      tick();

      expect(onAutofill).toHaveBeenCalledWith({
        form,
        values: { email: "a@b.co", password: "secret" },
        filled: ["password"],
      });
    });

    it("lets onAutofill veto and stays armed", () => {
      let allow = false;
      const { result } = setup({ onAutofill: () => allow });
      interact();
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();
      expect(requestSubmit).not.toHaveBeenCalled();
      expect(result.current.isArmed()).toBe(true);

      allow = true;
      fill(password, "other");
      tick();
      expect(requestSubmit).toHaveBeenCalledTimes(1);
    });

    it("uses the latest callbacks without re-subscribing", () => {
      const first = vi.fn();
      const second = vi.fn();
      const { rerender } = renderHook(
        ({ onAutofill }) =>
          useAutofillSubmit(formRef, {
            fields: ["email", "password"],
            onAutofill,
          }),
        { initialProps: { onAutofill: first } }
      );
      rerender({ onAutofill: second });
      interact();
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });

    it("replaces submission with a custom submit", () => {
      const submit = vi.fn();
      setup({ submit });
      interact();
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();

      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({
          form,
          values: { email: "a@b.co", password: "secret" },
        })
      );
      expect(requestSubmit).not.toHaveBeenCalled();
    });
  });

  describe("fallback without requestSubmit", () => {
    beforeEach(() => {
      (form as { requestSubmit?: unknown }).requestSubmit = undefined;
      form.submit = vi.fn();
    });

    it("dispatches submit then calls form.submit()", () => {
      const onSubmit = vi.fn();
      form.addEventListener("submit", onSubmit);
      setup();
      interact();
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(form.submit).toHaveBeenCalledTimes(1);
    });

    it("does not call form.submit() when the submit event is prevented", () => {
      form.addEventListener("submit", (event) => event.preventDefault());
      setup();
      interact();
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();

      expect(form.submit).not.toHaveBeenCalled();
    });
  });

  describe("controls", () => {
    it("rearm allows another auto-submit", () => {
      const { result } = setup();
      interact();
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();
      expect(result.current.isArmed()).toBe(false);

      act(() => result.current.rearm());
      fill(password, "retry");
      tick();
      expect(requestSubmit).toHaveBeenCalledTimes(2);
    });

    it("disarm prevents auto-submit", () => {
      const { result } = setup();
      interact();
      act(() => result.current.disarm());
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();

      expect(requestSubmit).not.toHaveBeenCalled();
    });

    it("rearms and re-baselines when the form is reset", () => {
      const { result } = setup();
      interact();
      act(() => result.current.disarm());
      act(() => void form.dispatchEvent(new Event("reset")));

      expect(result.current.isArmed()).toBe(true);
    });

    it("does not read restored default values as a fill after reset", () => {
      email.setAttribute("value", "");
      setup();
      interact();
      email.value = "a@b.co";
      password.value = "secret";
      act(() => void form.reset());
      tick(2);

      expect(requestSubmit).not.toHaveBeenCalled();
    });

    it("returns stable control functions", () => {
      const { result, rerender } = setup();
      const first = result.current;
      rerender();

      expect(result.current.rearm).toBe(first.rearm);
      expect(result.current.disarm).toBe(first.disarm);
      expect(result.current.isArmed).toBe(first.isArmed);
    });
  });

  describe("cleanup", () => {
    it("stops sampling and removes listeners on unmount", () => {
      const clear = vi.spyOn(window, "clearInterval");
      const remove = vi.spyOn(form, "removeEventListener");
      const { unmount } = setup();
      unmount();

      expect(clear).toHaveBeenCalled();
      expect(remove).toHaveBeenCalledWith("input", expect.any(Function));
      expect(remove).toHaveBeenCalledWith("submit", expect.any(Function));
      expect(remove).toHaveBeenCalledWith("reset", expect.any(Function));
      expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));

      form.dispatchEvent(new Event("keydown"));
      fill(email, "a@b.co");
      fill(password, "secret");
      tick();
      expect(requestSubmit).not.toHaveBeenCalled();
    });
  });

  describe("types", () => {
    it("infers field names as literals", () => {
      renderHook(() =>
        useAutofillSubmit(formRef, {
          fields: ["email", "password"],
          onAutofill: ({ values, filled }) => {
            expectTypeOf(values).toEqualTypeOf<
              Readonly<Record<"email" | "password", string>>
            >();
            expectTypeOf(filled).toEqualTypeOf<
              readonly ("email" | "password")[]
            >();
            // @ts-expect-error unknown field name
            void values.username;
          },
          isFilled: (value, name, element) => {
            expectTypeOf(value).toBeString();
            expectTypeOf(name).toEqualTypeOf<"email" | "password">();
            expectTypeOf(element).toMatchTypeOf<
              HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
            >();
            return true;
          },
        })
      );
    });

    it("returns typed controls and accepts nullable refs", () => {
      const { result } = setup();

      expectTypeOf(result.current).toEqualTypeOf<UseAutofillSubmitResult>();
      expectTypeOf<AutofillContext<"a">["values"]>().toEqualTypeOf<
        Readonly<Record<"a", string>>
      >();
      expectTypeOf(useAutofillSubmit<"a">)
        .parameter(0)
        .toEqualTypeOf<RefObject<HTMLFormElement | null>>();
    });
  });
});
