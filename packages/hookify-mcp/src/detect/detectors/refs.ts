import type { Node } from "@babel/types";

import {
  type Effect,
  effectsOf,
  type FunctionNode,
  isConstant,
  isFunctionNode,
  makeFinding,
  refAssignments,
  referenceKey,
  refsOf,
  walk,
} from "../ast.ts";
import type { Detector, Finding } from "../types.ts";

/**
 * Checks whether a function reads `ref.current` while it renders, which means
 * outside any function nested in it, and not as the target of an assignment.
 *
 * @param fn - The component or custom hook.
 * @param name - The ref's variable name.
 * @returns `true` when the render reads the ref.
 */
const readsDuringRender = (fn: FunctionNode, name: string): boolean => {
  let reads = false;
  walk(fn, (node, ancestors) => {
    if (node !== fn && isFunctionNode(node)) return false;
    if (
      node.type !== "MemberExpression" ||
      referenceKey(node) !== `${name}.current`
    ) {
      return;
    }
    const parent = ancestors.at(-1);
    if (parent?.type === "AssignmentExpression" && parent.left === node) return;
    reads = true;
  });
  return reads;
};

/**
 * Lists the statements an effect runs.
 *
 * @param effect - The effect.
 * @returns The statements, or the single expression of an arrow function.
 */
const statementsOf = (effect: Effect): Node[] =>
  effect.callback.body.type === "BlockStatement"
    ? effect.callback.body.body
    : [effect.callback.body];

/**
 * Finds a ref that is assigned the value of a variable in an effect and read
 * while rendering, which is how "the value from the last render" is written by
 * hand.
 */
export const previousValueRef: Detector = {
  pattern: "previous-value-ref",
  hooks: ["usePrevious"],
  detect: (ast) => {
    const findings: Finding[] = [];

    walk(ast, (node) => {
      if (!isFunctionNode(node)) return;
      const refs = refsOf(node);
      if (refs.length === 0) return;

      for (const effect of effectsOf(node)) {
        for (const { name } of refs) {
          const assignments = refAssignments(effect.callback, name, {
            nested: false,
          }).filter((assignment) => !isConstant(assignment.right));
          if (assignments.length === 0) continue;
          if (!readsDuringRender(node, name)) continue;

          const onlyAssignment =
            statementsOf(effect).length === 1 && assignments.length === 1;
          findings.push(
            makeFinding(
              "previous-value-ref",
              "usePrevious",
              onlyAssignment ? "high" : "medium",
              "Stores a value in a ref in an effect and reads the ref while rendering to get the previous value; usePrevious does that without the ref bookkeeping.",
              effect.call
            )
          );
        }
      }
    });
    return findings;
  },
};

/**
 * Finds a ref that an effect sets to `true` and its cleanup sets back to
 * `false`, which is how "is this component still mounted" is written by hand.
 */
export const mountedRef: Detector = {
  pattern: "mounted-ref",
  hooks: ["useMounted"],
  detect: (ast) => {
    const findings: Finding[] = [];

    walk(ast, (node) => {
      if (!isFunctionNode(node)) return;
      const refs = refsOf(node).filter(
        ({ init }) => init?.type === "BooleanLiteral"
      );
      if (refs.length === 0) return;

      for (const effect of effectsOf(node)) {
        if (!effect.cleanup) continue;
        const cleanup = effect.cleanup;

        for (const { name, init } of refs) {
          const clears = refAssignments(cleanup, name, {
            nested: false,
          }).some(
            (assignment) =>
              assignment.right.type === "BooleanLiteral" &&
              !assignment.right.value
          );
          if (!clears) continue;

          const sets = refAssignments(effect.callback, name, {
            nested: false,
          }).some(
            (assignment) =>
              assignment.right.type === "BooleanLiteral" &&
              assignment.right.value
          );
          const startsTrue = init?.type === "BooleanLiteral" && init.value;
          if (!sets && !startsTrue) continue;

          findings.push(
            makeFinding(
              "mounted-ref",
              "useMounted",
              sets ? "high" : "medium",
              "Tracks whether the component is mounted with a ref that its effect sets to true and the cleanup sets to false; useMounted returns that check and runs optional onMount and onUnmount callbacks.",
              effect.call
            )
          );
        }
      }
    });
    return findings;
  },
};
