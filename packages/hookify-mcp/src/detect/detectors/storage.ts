import type { CallExpression } from "@babel/types";

import {
  effectsOf,
  type FunctionNode,
  hookCallName,
  isFunctionNode,
  makeFinding,
  referencedNames,
  storageCalls,
  walk,
} from "../ast.ts";
import type { Detector, Finding } from "../types.ts";

/**
 * Finds the state a function declares with `useState`.
 *
 * @param fn - The function, such as a component.
 * @returns The `useState` calls, and the names of the values and setters they
 *   declare.
 */
const stateOf = (
  fn: FunctionNode
): { calls: CallExpression[]; names: Set<string> } => {
  const calls: CallExpression[] = [];
  const names = new Set<string>();
  walk(fn, (node, ancestors) => {
    if (node !== fn && isFunctionNode(node)) return false;
    if (node.type !== "CallExpression" || hookCallName(node) !== "useState") {
      return;
    }
    calls.push(node);
    const parent = ancestors.at(-1);
    if (
      parent?.type === "VariableDeclarator" &&
      parent.id.type === "ArrayPattern"
    ) {
      for (const element of parent.id.elements) {
        if (element?.type === "Identifier") names.add(element.name);
      }
    }
  });
  return { calls, names };
};

/** The hand-written storage mirror that `usePersistedState` replaces. */
export const storageMirroredState: Detector = {
  pattern: "storage-mirrored-state",
  hooks: ["usePersistedState"],
  detect: (ast) => {
    const findings: Finding[] = [];

    walk(ast, (node) => {
      if (!isFunctionNode(node) || node.body.type !== "BlockStatement") return;

      const { calls: stateCalls, names: stateNames } = stateOf(node);
      if (stateCalls.length === 0) return;

      const effects = effectsOf(node);
      const readsStorage =
        stateCalls.some((call) =>
          call.arguments.some(
            (argument) => storageCalls(argument, "getItem").length > 0
          )
        ) ||
        effects.some(
          (effect) => storageCalls(effect.callback, "getItem").length > 0
        );

      for (const effect of effects) {
        const writes = storageCalls(effect.callback, "setItem");
        if (writes.length === 0) continue;

        const writesState = writes.some((write) =>
          [...referencedNames(write)].some((name) => stateNames.has(name))
        );
        if (!writesState) continue;

        findings.push(
          makeFinding(
            "storage-mirrored-state",
            "usePersistedState",
            readsStorage ? "high" : "medium",
            "Copies state to web storage in an effect and reads it back by hand; usePersistedState does both, copes with blocked or full storage and syncs other tabs.",
            effect.call
          )
        );
      }
    });
    return findings;
  },
};
