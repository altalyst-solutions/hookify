import type { Node } from "@babel/types";

import {
  findAll,
  findEffects,
  globalCallName,
  makeFinding,
  methodCalls,
  rootName,
} from "../ast.ts";
import type { Detector, Finding } from "../types.ts";
import { matchMediaNames } from "./match-media.ts";

/**
 * Finds the names declared in a function that hold objects the code creates
 * itself, such as a `WebSocket`. A hook can't listen on those, because they
 * don't exist until the effect runs.
 *
 * @param root - The effect's function.
 * @returns The variable names.
 */
const createdNames = (root: Node): Set<string> => {
  const names = new Set<string>();
  for (const declarator of findAll(
    root,
    (node): node is Extract<Node, { type: "VariableDeclarator" }> =>
      node.type === "VariableDeclarator"
  )) {
    const { id, init } = declarator;
    if (id.type !== "Identifier" || !init) continue;
    const createsElement =
      init.type === "CallExpression" &&
      init.callee.type === "MemberExpression" &&
      init.callee.property.type === "Identifier" &&
      init.callee.property.name === "createElement";
    if (init.type === "NewExpression" || createsElement) names.add(id.name);
  }
  return names;
};

/** The hand-written `addEventListener` in an effect that `useEventListener` replaces. */
export const eventListenerInEffect: Detector = {
  pattern: "event-listener-in-effect",
  hooks: ["useEventListener"],
  detect: (ast) => {
    const mediaLists = matchMediaNames(ast);
    const findings: Finding[] = [];

    for (const effect of findEffects(ast)) {
      const created = createdNames(effect.callback);
      const added = methodCalls(effect.callback, "addEventListener").filter(
        (call) => {
          const { callee } = call;
          if (callee.type !== "MemberExpression") return false;
          const { object } = callee;
          if (object.type === "CallExpression") {
            return globalCallName(object) !== "matchMedia";
          }
          const name = rootName(object);
          return (
            name === undefined || (!created.has(name) && !mediaLists.has(name))
          );
        }
      );
      if (added.length === 0) continue;

      const [first] = added;
      const [type] = first.arguments;
      const label = type?.type === "StringLiteral" ? `a "${type.value}"` : "an";
      const removed =
        methodCalls(effect.callback, "removeEventListener").length > 0;

      findings.push(
        makeFinding(
          "event-listener-in-effect",
          "useEventListener",
          removed ? "high" : "medium",
          removed
            ? `Adds ${label} event listener in an effect and removes it in the cleanup; useEventListener does both and always calls the latest handler.`
            : `Adds ${label} event listener in an effect and never removes it; useEventListener removes it on cleanup and always calls the latest handler.`,
          effect.call
        )
      );
    }
    return findings;
  },
};
