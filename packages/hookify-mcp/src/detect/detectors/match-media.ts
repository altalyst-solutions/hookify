import type { File, Node } from "@babel/types";

import {
  findAll,
  globalCallName,
  makeFinding,
  methodCalls,
  nearestFunction,
  walk,
} from "../ast.ts";
import type { Detector, Finding } from "../types.ts";

/** Methods that subscribe to a `MediaQueryList`, the current and the deprecated one. */
const SUBSCRIBE_METHODS = ["addEventListener", "addListener"];

/**
 * Finds the variables that hold the result of `matchMedia(...)`.
 *
 * @param ast - The parsed file.
 * @returns Their names, which the event listener detector uses to leave these
 *   subscriptions to {@link matchMediaListener}.
 */
export const matchMediaNames = (ast: File): Set<string> => {
  const names = new Set<string>();
  walk(ast, (node) => {
    if (
      node.type === "VariableDeclarator" &&
      node.id.type === "Identifier" &&
      node.init?.type === "CallExpression" &&
      globalCallName(node.init) === "matchMedia"
    ) {
      names.add(node.id.name);
    }
  });
  return names;
};

/**
 * Checks whether code subscribes to a `MediaQueryList` held in a variable.
 *
 * @param scope - The code to look in.
 * @param name - The variable's name.
 * @returns `true` when it calls `addEventListener` or `addListener` on it, or
 *   assigns `onchange`.
 */
const subscribesTo = (scope: Node, name: string): boolean =>
  SUBSCRIBE_METHODS.some((method) =>
    methodCalls(scope, method).some(
      (call) =>
        call.callee.type === "MemberExpression" &&
        call.callee.object.type === "Identifier" &&
        call.callee.object.name === name
    )
  ) ||
  findAll(
    scope,
    (node): node is Extract<Node, { type: "AssignmentExpression" }> =>
      node.type === "AssignmentExpression" &&
      node.left.type === "MemberExpression" &&
      node.left.object.type === "Identifier" &&
      node.left.object.name === name &&
      node.left.property.type === "Identifier" &&
      node.left.property.name === "onchange"
  ).length > 0;

/** The hand-written `matchMedia` subscription that `useMediaQuery` replaces. */
export const matchMediaListener: Detector = {
  pattern: "match-media-listener",
  hooks: ["useMediaQuery"],
  detect: (ast) => {
    const findings: Finding[] = [];

    walk(ast, (node, ancestors) => {
      if (
        node.type !== "CallExpression" ||
        globalCallName(node) !== "matchMedia"
      ) {
        return;
      }
      const parent = ancestors.at(-1);
      let subscribes = false;

      if (parent?.type === "MemberExpression" && parent.object === node) {
        subscribes =
          !parent.computed &&
          parent.property.type === "Identifier" &&
          SUBSCRIBE_METHODS.includes(parent.property.name);
      } else {
        let name: string | undefined;
        if (
          parent?.type === "VariableDeclarator" &&
          parent.id.type === "Identifier"
        ) {
          name = parent.id.name;
        } else if (
          parent?.type === "AssignmentExpression" &&
          parent.left.type === "Identifier"
        ) {
          name = parent.left.name;
        }
        if (name !== undefined) {
          const scope = nearestFunction(ancestors) ?? ast.program;
          subscribes = subscribesTo(scope, name);
        }
      }

      if (subscribes) {
        findings.push(
          makeFinding(
            "match-media-listener",
            "useMediaQuery",
            "high",
            "Subscribes to a matchMedia query by hand; useMediaQuery returns whether it matches, updates on change and is safe to hydrate.",
            node
          )
        );
      }
    });
    return findings;
  },
};
