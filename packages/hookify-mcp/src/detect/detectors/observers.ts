import type { CallExpression, Node } from "@babel/types";

import {
  type Effect,
  findEffects,
  globalCallName,
  makeFinding,
  methodCalls,
  walk,
} from "../ast.ts";
import type { Detector, Finding, PatternId } from "../types.ts";

/** Array methods whose callbacks run once for each item. */
const ITERATION_METHODS = new Set([
  "forEach",
  "map",
  "filter",
  "some",
  "every",
  "reduce",
  "flatMap",
]);

/** Statements that repeat. */
const LOOPS = new Set([
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
]);

/** Names that suggest a resize callback reads the element's size. */
const SIZE_NAMES = new Set([
  "contentRect",
  "borderBoxSize",
  "contentBoxSize",
  "inlineSize",
  "blockSize",
  "width",
  "height",
]);

/**
 * Finds the `observe` calls on a variable that are made once, not for every
 * item of a collection. The hooks watch one element, so an observer that
 * watches many elements isn't something they replace.
 *
 * @param effect - The effect.
 * @param name - The observer variable's name.
 * @returns The single-element `observe` calls.
 */
const singleObserveCalls = (effect: Effect, name: string): CallExpression[] => {
  const found: CallExpression[] = [];
  walk(effect.callback, (node, ancestors) => {
    if (
      node.type !== "CallExpression" ||
      node.callee.type !== "MemberExpression" ||
      node.callee.object.type !== "Identifier" ||
      node.callee.object.name !== name ||
      node.callee.property.type !== "Identifier" ||
      node.callee.property.name !== "observe"
    ) {
      return;
    }
    const repeated = ancestors.some(
      (ancestor) =>
        LOOPS.has(ancestor.type) ||
        (ancestor.type === "CallExpression" &&
          ancestor.callee.type === "MemberExpression" &&
          ancestor.callee.property.type === "Identifier" &&
          ITERATION_METHODS.has(ancestor.callee.property.name))
    );
    if (!repeated) found.push(node);
  });
  return found;
};

/**
 * Checks whether an observer's callback reads the observed element's size.
 *
 * @param callback - The first argument given to `new ResizeObserver`.
 * @returns `true` when it mentions a size, such as `contentRect.width`.
 */
const readsSize = (callback: Node | undefined): boolean => {
  if (!callback) return false;
  let reads = false;
  walk(callback, (node) => {
    if (
      (node.type === "Identifier" && SIZE_NAMES.has(node.name)) ||
      (node.type === "MemberExpression" &&
        !node.computed &&
        node.property.type === "Identifier" &&
        SIZE_NAMES.has(node.property.name))
    ) {
      reads = true;
    }
  });
  return reads;
};

/**
 * Builds a detector for an observer constructed in an effect.
 *
 * @param pattern - The pattern id.
 * @param constructorName - `IntersectionObserver` or `ResizeObserver`.
 * @param hooks - Every hook the detector can suggest.
 * @param suggest - Picks the hook for one `new` expression.
 * @returns The detector.
 */
const observerDetector = (
  pattern: PatternId,
  constructorName: string,
  hooks: readonly string[],
  suggest: (construction: Node) => string
): Detector => ({
  pattern,
  hooks,
  detect: (ast) => {
    const findings: Finding[] = [];

    for (const effect of findEffects(ast)) {
      walk(effect.callback, (node, ancestors) => {
        if (
          node.type !== "NewExpression" ||
          globalCallName(node) !== constructorName
        ) {
          return;
        }
        const parent = ancestors.at(-1);
        if (
          parent?.type !== "VariableDeclarator" ||
          parent.id.type !== "Identifier"
        ) {
          return;
        }
        const { name } = parent.id;
        if (singleObserveCalls(effect, name).length === 0) return;

        const cleanedUp =
          methodCalls(effect.callback, "disconnect").length > 0 ||
          methodCalls(effect.callback, "unobserve").length > 0;
        const hook = suggest(node);

        findings.push(
          makeFinding(
            pattern,
            hook,
            cleanedUp ? "high" : "medium",
            cleanedUp
              ? `Creates a ${constructorName} in an effect and disconnects it in the cleanup; ${hook} does the same and handles the element ref.`
              : `Creates a ${constructorName} in an effect and never disconnects it; ${hook} disconnects on unmount and handles the element ref.`,
            effect.call
          )
        );
      });
    }
    return findings;
  },
});

/** The hand-written `IntersectionObserver` that `useIntersectionObserver` replaces. */
export const intersectionObserverInEffect = observerDetector(
  "intersection-observer-in-effect",
  "IntersectionObserver",
  ["useIntersectionObserver"],
  () => "useIntersectionObserver"
);

/**
 * The hand-written `ResizeObserver` that `useElementSize` or
 * `useResizeObserver` replaces: `useElementSize` when the callback reads the
 * element's size, `useResizeObserver` when it doesn't.
 */
export const resizeObserverInEffect = observerDetector(
  "resize-observer-in-effect",
  "ResizeObserver",
  ["useElementSize", "useResizeObserver"],
  (construction) =>
    construction.type === "NewExpression" &&
    readsSize(construction.arguments[0])
      ? "useElementSize"
      : "useResizeObserver"
);
