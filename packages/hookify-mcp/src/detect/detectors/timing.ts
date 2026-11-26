import type { AssignmentExpression, CallExpression, Node } from "@babel/types";

import {
  asEffect,
  findAll,
  findEffects,
  type FunctionNode,
  globalCalls,
  isConstant,
  isFunctionNode,
  makeFinding,
  referencedNames,
  referenceKey,
  walk,
} from "../ast.ts";
import type { Detector, Finding } from "../types.ts";

/** Matches the name of a React state setter, such as `setQuery`. */
const SETTER_NAME = /^set[A-Z]/;

/**
 * Names the state that a setter updates.
 *
 * @param call - A call to a setter such as `setQuery(...)`.
 * @returns `query`, following the `[query, setQuery]` naming convention, or
 *   an empty string if the callee isn't a name.
 */
const stateNameOf = (call: CallExpression): string => {
  if (call.callee.type !== "Identifier") return "";
  const name = call.callee.name.slice(3);
  return name.charAt(0).toLowerCase() + name.slice(1);
};

/**
 * Lists the calls a `setTimeout` callback makes.
 *
 * @param timeout - The `setTimeout(...)` call.
 * @returns The calls inside its first argument, or none if that isn't a function.
 */
const callsInTimeout = (timeout: CallExpression): CallExpression[] => {
  const [callback] = timeout.arguments;
  if (!callback || !isFunctionNode(callback)) return [];
  return findAll(
    callback.body,
    (node): node is CallExpression => node.type === "CallExpression"
  );
};

/**
 * Finds effects that delay an update until a value stops changing: they depend
 * on a value, start a `setTimeout` that uses it, and clear the timer in the
 * cleanup.
 */
export const debouncedValueInEffect: Detector = {
  pattern: "debounced-value-in-effect",
  hooks: ["useDebouncedValue"],
  detect: (ast) => {
    const findings: Finding[] = [];

    for (const effect of findEffects(ast)) {
      if (effect.deps?.type !== "ArrayExpression") continue;
      if (effect.deps.elements.length === 0) continue;
      if (!effect.cleanup) continue;
      if (globalCalls(effect.cleanup, "clearTimeout").length === 0) continue;

      const deps = referencedNames(effect.deps);
      const timeouts = globalCalls(effect.callback, "setTimeout");

      let confidence: "high" | "medium" | undefined;
      for (const timeout of timeouts) {
        for (const call of callsInTimeout(timeout)) {
          const usesDependency = call.arguments.some(
            (argument) =>
              !isConstant(argument) &&
              [...referencedNames(argument)].some((name) => deps.has(name))
          );
          if (!usesDependency) continue;
          const isSetter =
            call.callee.type === "Identifier" &&
            SETTER_NAME.test(call.callee.name);
          // A setter whose state is also a dependency schedules its own next
          // run, like a countdown, rather than delaying another value.
          if (isSetter && deps.has(stateNameOf(call))) continue;
          if (isSetter) confidence = "high";
          else confidence ??= "medium";
        }
      }
      if (!confidence) continue;

      findings.push(
        makeFinding(
          "debounced-value-in-effect",
          "useDebouncedValue",
          confidence,
          confidence === "high"
            ? "Waits in an effect with setTimeout, clearing it when the value changes, before copying the value to state; useDebouncedValue does exactly that."
            : "Waits in an effect with setTimeout, clearing it when the value changes, before acting on the value; useDebouncedValue gives you the settled value to run the effect on.",
          effect.call
        )
      );
    }
    return findings;
  },
};

/**
 * Finds a function that cancels its pending timer and starts a new one, which
 * is how a debounce is usually written by hand.
 */
export const debouncedCallback: Detector = {
  pattern: "debounced-callback",
  hooks: ["useDebouncedCallback"],
  detect: (ast) => {
    const findings: Finding[] = [];

    walk(ast, (node, ancestors) => {
      if (!isFunctionNode(node)) return;
      // An effect's own function is the effect detector's job.
      const parent = ancestors.at(-1);
      if (parent && asEffect(parent)?.callback === node) return;

      const clears = globalCalls(node, "clearTimeout", { nested: false });
      const starts = findAll(
        node,
        (child): child is AssignmentExpression =>
          child.type === "AssignmentExpression" &&
          child.right.type === "CallExpression" &&
          globalCalls(child, "setTimeout").includes(child.right),
        { nested: false }
      );

      const restarts = clears.some((clear) => {
        const key = clear.arguments[0] && referenceKey(clear.arguments[0]);
        return (
          key !== undefined &&
          starts.some(
            (start) =>
              referenceKey(start.left) === key &&
              (start.start ?? 0) > (clear.start ?? 0)
          )
        );
      });
      if (!restarts) return;

      findings.push(
        makeFinding(
          "debounced-callback",
          "useDebouncedCallback",
          "high",
          "Clears a pending setTimeout and starts a new one on every call, which is a hand-written debounce; useDebouncedCallback adds cancel, flush and leading or trailing calls.",
          node
        )
      );
    });
    return findings;
  },
};

/**
 * Checks whether an expression reads the clock with `Date.now()`.
 *
 * @param node - The expression.
 * @returns `true` for `Date.now()`.
 */
const isDateNow = (node: Node): boolean =>
  node.type === "CallExpression" &&
  node.callee.type === "MemberExpression" &&
  node.callee.object.type === "Identifier" &&
  node.callee.object.name === "Date" &&
  node.callee.property.type === "Identifier" &&
  node.callee.property.name === "now";

/**
 * Finds the names a function sets to the current time with
 * `const now = Date.now()`.
 *
 * @param fn - The function.
 * @returns The names.
 */
const clockNames = (fn: FunctionNode): Set<string> => {
  const names = new Set<string>();
  for (const declarator of findAll(
    fn,
    (node): node is Extract<Node, { type: "VariableDeclarator" }> =>
      node.type === "VariableDeclarator",
    { nested: false }
  )) {
    if (
      declarator.id.type === "Identifier" &&
      declarator.init &&
      isDateNow(declarator.init)
    ) {
      names.add(declarator.id.name);
    }
  }
  return names;
};

/**
 * Finds a function that compares the time since its last call with an
 * interval and then records the time again, which is a hand-written throttle.
 */
export const throttledCallback: Detector = {
  pattern: "throttled-callback",
  hooks: ["useRateLimitedCallback"],
  detect: (ast) => {
    const findings: Finding[] = [];

    walk(ast, (node) => {
      if (!isFunctionNode(node)) return;
      const clocks = clockNames(node);
      const isClock = (expression: Node) =>
        isDateNow(expression) ||
        (expression.type === "Identifier" && clocks.has(expression.name));

      const recorded = findAll(
        node.body,
        (child): child is AssignmentExpression =>
          child.type === "AssignmentExpression" &&
          child.operator === "=" &&
          isClock(child.right)
      ).map((assignment) => referenceKey(assignment.left));

      const compared = findAll(
        node,
        (child): child is Extract<Node, { type: "BinaryExpression" }> =>
          child.type === "BinaryExpression" &&
          ["<", "<=", ">", ">="].includes(child.operator),
        { nested: false }
      ).some((comparison) => {
        const elapsed = [comparison.left, comparison.right].find(
          (side) => side.type === "BinaryExpression" && side.operator === "-"
        );
        if (elapsed?.type !== "BinaryExpression") return false;
        const last = referenceKey(elapsed.right);
        return (
          isClock(elapsed.left) && last !== undefined && recorded.includes(last)
        );
      });
      if (!compared) return;

      findings.push(
        makeFinding(
          "throttled-callback",
          "useRateLimitedCallback",
          "medium",
          "Compares Date.now() with the time of the last call and records it again, which is a hand-written throttle; useRateLimitedCallback limits calls per window and can drop or queue the extra ones.",
          node
        )
      );
    });
    return findings;
  },
};
