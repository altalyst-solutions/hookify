import type {
  ArrowFunctionExpression,
  AssignmentExpression,
  CallExpression,
  ClassMethod,
  FunctionDeclaration,
  FunctionExpression,
  NewExpression,
  Node,
  ObjectMethod,
  ReturnStatement,
  VariableDeclarator,
} from "@babel/types";

import type { Confidence, Finding, PatternId, SourceRange } from "./types.ts";

/** Node properties that hold positions or comments, not code. */
const NON_CODE_KEYS = new Set([
  "loc",
  "start",
  "end",
  "extra",
  "range",
  "leadingComments",
  "trailingComments",
  "innerComments",
  "comments",
  "tokens",
  "errors",
]);

/**
 * Checks whether a value is an AST node.
 *
 * @param value - Anything.
 * @returns `true` when it is an object with a string `type`.
 */
const isNode = (value: unknown): value is Node =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { type?: unknown }).type === "string";

/**
 * Lists the direct children of a node, in source order.
 *
 * @param node - The parent.
 * @returns Its child nodes.
 */
const childNodes = (node: Node): Node[] => {
  const children: Node[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (NON_CODE_KEYS.has(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) children.push(item);
    } else if (isNode(value)) {
      children.push(value);
    }
  }
  return children.sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
};

/**
 * Called for each node. Return `false` to skip the node's children.
 *
 * `ancestors` lists the parents of the node, from the walk's root to the
 * closest one.
 */
export type Visitor = (
  node: Node,
  ancestors: readonly Node[]
) => boolean | void;

/**
 * Visits a node and everything under it, parents before children.
 *
 * @param root - Where to start.
 * @param visit - Called for each node.
 * @param ancestors - The parents of `root`. Leave it out.
 */
export const walk = (
  root: Node,
  visit: Visitor,
  ancestors: Node[] = []
): void => {
  if (visit(root, ancestors) === false) return;
  ancestors.push(root);
  for (const child of childNodes(root)) walk(child, visit, ancestors);
  ancestors.pop();
};

/** Every kind of node that has its own `this`, arguments and scope. */
export type FunctionNode =
  | ArrowFunctionExpression
  | FunctionExpression
  | FunctionDeclaration
  | ObjectMethod
  | ClassMethod;

/**
 * Checks whether a node is a function.
 *
 * @param node - The node.
 * @returns `true` for arrow functions, function expressions and declarations, and methods.
 */
export const isFunctionNode = (node: Node): node is FunctionNode =>
  node.type === "ArrowFunctionExpression" ||
  node.type === "FunctionExpression" ||
  node.type === "FunctionDeclaration" ||
  node.type === "ObjectMethod" ||
  node.type === "ClassMethod";

/**
 * Finds the closest function around a node.
 *
 * @param ancestors - The node's ancestors.
 * @returns The function, or `undefined` at the top level.
 */
export const nearestFunction = (
  ancestors: readonly Node[]
): FunctionNode | undefined => ancestors.findLast(isFunctionNode);

/** Options for {@link findAll}. */
interface FindOptions {
  /** Look inside functions nested in the root. Default is `true`. */
  nested?: boolean;
}

/**
 * Finds the nodes under a root that satisfy a test.
 *
 * @param root - Where to look. It is tested too.
 * @param test - A type guard.
 * @param options - See {@link FindOptions}.
 * @returns The matching nodes in source order.
 */
export const findAll = <T extends Node>(
  root: Node,
  test: (node: Node) => node is T,
  options: FindOptions = {}
): T[] => {
  const { nested = true } = options;
  const found: T[] = [];
  walk(root, (node) => {
    if (!nested && node !== root && isFunctionNode(node)) return false;
    if (test(node)) found.push(node);
  });
  return found;
};

/** Objects that hold the global scope, so `window.setInterval` is `setInterval`. */
const GLOBAL_OBJECTS = new Set(["window", "globalThis", "self"]);

/**
 * Names the function a call or `new` expression uses, looking through the
 * global object.
 *
 * @param call - The expression.
 * @returns `setInterval` for `setInterval()` and `window.setInterval()`, or
 *   `undefined` for anything else, such as `timers.setInterval()`.
 */
export const globalCallName = (
  call: CallExpression | NewExpression
): string | undefined => {
  const { callee } = call;
  if (callee.type === "Identifier") return callee.name;
  if (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    GLOBAL_OBJECTS.has(callee.object.name) &&
    callee.property.type === "Identifier"
  ) {
    return callee.property.name;
  }
  return undefined;
};

/**
 * Names the hook a call uses, looking through `React.`.
 *
 * @param call - The call.
 * @returns `useEffect` for `useEffect()` and `React.useEffect()`.
 */
export const hookCallName = (call: CallExpression): string | undefined => {
  const { callee } = call;
  if (callee.type === "Identifier") return callee.name;
  if (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "React" &&
    callee.property.type === "Identifier"
  ) {
    return callee.property.name;
  }
  return undefined;
};

/**
 * Finds the calls to a method, such as `target.addEventListener(...)`.
 *
 * @param root - Where to look.
 * @param method - The method name.
 * @param options - See {@link FindOptions}.
 * @returns The calls, whatever object they are made on.
 */
export const methodCalls = (
  root: Node,
  method: string,
  options?: FindOptions
): CallExpression[] =>
  findAll(
    root,
    (node): node is CallExpression =>
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      !node.callee.computed &&
      node.callee.property.type === "Identifier" &&
      node.callee.property.name === method,
    options
  );

/**
 * Finds the calls to a global function, such as `setInterval(...)`.
 *
 * @param root - Where to look.
 * @param name - The function name.
 * @param options - See {@link FindOptions}.
 * @returns The calls to `name` or `window.name`.
 */
export const globalCalls = (
  root: Node,
  name: string,
  options?: FindOptions
): CallExpression[] =>
  findAll(
    root,
    (node): node is CallExpression =>
      node.type === "CallExpression" && globalCallName(node) === name,
    options
  );

/**
 * Writes a plain reference, such as `timer.current`, as text so two
 * references can be compared.
 *
 * @param node - The expression.
 * @returns The text, or `undefined` for anything that is not a plain name or a
 *   chain of dotted names.
 */
export const referenceKey = (node: Node): string | undefined => {
  if (node.type === "Identifier") return node.name;
  if (node.type === "ThisExpression") return "this";
  if (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.property.type === "Identifier"
  ) {
    const object = referenceKey(node.object);
    return object === undefined ? undefined : `${object}.${node.property.name}`;
  }
  return undefined;
};

/**
 * Finds the name a chain of property accesses starts with.
 *
 * @param node - An expression such as `socket.current`.
 * @returns `socket`, or `undefined` if the chain doesn't start with a name.
 */
export const rootName = (node: Node): string | undefined => {
  let current: Node = node;
  while (current.type === "MemberExpression") current = current.object;
  return current.type === "Identifier" ? current.name : undefined;
};

/**
 * Checks whether an expression is a fixed value that can't carry state, such
 * as `false`, `null`, a plain string or a function.
 *
 * @param node - The expression.
 * @returns `true` for literals, `undefined` and functions.
 */
export const isConstant = (node: Node): boolean => {
  switch (node.type) {
    case "NullLiteral":
    case "BooleanLiteral":
    case "NumericLiteral":
    case "StringLiteral":
    case "BigIntLiteral":
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return true;
    case "TemplateLiteral":
      return node.expressions.length === 0;
    case "Identifier":
      return node.name === "undefined";
    case "UnaryExpression":
      return isConstant(node.argument);
    default:
      return false;
  }
};

/**
 * Collects the names an expression refers to.
 *
 * @param node - The expression, such as a dependency array.
 * @returns The names it starts a reference with, such as `query` for
 *   `query.trim()` and `props.id`.
 */
export const referencedNames = (node: Node): Set<string> => {
  const names = new Set<string>();
  walk(node, (child, ancestors) => {
    if (child.type !== "Identifier") return;
    const parent = ancestors.at(-1);
    const isProperty =
      parent?.type === "MemberExpression" &&
      parent.property === child &&
      !parent.computed;
    const isKey =
      (parent?.type === "ObjectProperty" || parent?.type === "ObjectMethod") &&
      parent.key === child &&
      !parent.computed;
    if (!isProperty && !isKey) names.add(child.name);
  });
  return names;
};

/** The hooks that run an effect. */
const EFFECT_HOOKS = new Set([
  "useEffect",
  "useLayoutEffect",
  "useInsertionEffect",
]);

/** An effect hook call, taken apart. */
export interface Effect {
  /** The `useEffect(...)` call. */
  call: CallExpression;
  /** The function that runs the effect. */
  callback: ArrowFunctionExpression | FunctionExpression;
  /** The dependency array argument, if there is one. */
  deps: Node | undefined;
  /** The function the effect returns to clean up, if it returns one. */
  cleanup: FunctionNode | undefined;
}

/**
 * Finds a function declared by name, as `function name() {}` or
 * `const name = () => {}`.
 *
 * @param root - Where to look.
 * @param name - The function's name.
 * @returns The function, or `undefined`.
 */
const declaredFunction = (
  root: Node,
  name: string
): FunctionNode | undefined => {
  for (const node of findAll(
    root,
    (candidate): candidate is FunctionDeclaration | VariableDeclarator =>
      candidate.type === "FunctionDeclaration" ||
      candidate.type === "VariableDeclarator"
  )) {
    if (node.type === "FunctionDeclaration") {
      if (node.id?.name === name) return node;
    } else if (
      node.id.type === "Identifier" &&
      node.id.name === name &&
      node.init &&
      isFunctionNode(node.init)
    ) {
      return node.init;
    }
  }
  return undefined;
};

/**
 * Finds the function an effect returns.
 *
 * @param callback - The effect's function.
 * @returns The cleanup function, which can be returned inline or by name.
 */
const cleanupOf = (
  callback: ArrowFunctionExpression | FunctionExpression
): FunctionNode | undefined => {
  const returned: Node[] = [];
  if (callback.body.type !== "BlockStatement") {
    returned.push(callback.body);
  } else {
    for (const statement of findAll(
      callback,
      (node): node is ReturnStatement => node.type === "ReturnStatement",
      { nested: false }
    )) {
      if (statement.argument) returned.push(statement.argument);
    }
  }

  for (const value of returned) {
    if (isFunctionNode(value)) return value;
    if (value.type !== "Identifier") continue;
    const named = declaredFunction(callback, value.name);
    if (named) return named;
  }
  return undefined;
};

/**
 * Takes an effect hook call apart.
 *
 * @param node - Any node.
 * @returns The effect, or `undefined` if the node isn't a call to
 *   `useEffect`, `useLayoutEffect` or `useInsertionEffect` with a function.
 */
export const asEffect = (node: Node): Effect | undefined => {
  if (node.type !== "CallExpression") return undefined;
  const name = hookCallName(node);
  if (name === undefined || !EFFECT_HOOKS.has(name)) return undefined;
  const [callback, deps] = node.arguments;
  if (
    callback?.type !== "ArrowFunctionExpression" &&
    callback?.type !== "FunctionExpression"
  ) {
    return undefined;
  }
  return { call: node, callback, deps, cleanup: cleanupOf(callback) };
};

/**
 * Finds the effects under a node.
 *
 * @param root - Where to look.
 * @param options - See {@link FindOptions}.
 * @returns The effects in source order.
 */
export const findEffects = (root: Node, options?: FindOptions): Effect[] => {
  const effects: Effect[] = [];
  const { nested = true } = options ?? {};
  walk(root, (node) => {
    if (!nested && node !== root && isFunctionNode(node)) return false;
    const effect = asEffect(node);
    if (effect) effects.push(effect);
  });
  return effects;
};

/**
 * Finds the effects a function declares itself, which excludes those in
 * functions nested in it.
 *
 * @param fn - The function, such as a component or a custom hook.
 * @returns Its effects.
 */
export const effectsOf = (fn: FunctionNode): Effect[] =>
  findEffects(fn, { nested: false });

/**
 * Describes where a node is in the source.
 *
 * @param node - The node.
 * @returns Its range.
 */
export const rangeOf = (node: Node): SourceRange => {
  const { start, end } = node.loc!;
  return {
    start: { line: start.line, column: start.column + 1 },
    end: { line: end.line, column: end.column + 1 },
  };
};

/**
 * Builds a finding for a node.
 *
 * @param pattern - The detector's pattern.
 * @param hook - The hook to suggest.
 * @param confidence - How sure the detector is.
 * @param reason - Why the hook fits.
 * @param node - The code the hook would replace.
 * @returns The finding.
 */
export const makeFinding = (
  pattern: PatternId,
  hook: string,
  confidence: Confidence,
  reason: string,
  node: Node
): Finding => ({ pattern, hook, confidence, reason, range: rangeOf(node) });

/** Names for the storage objects the browser provides. */
const STORAGE_NAMES = new Set(["localStorage", "sessionStorage"]);

/**
 * Checks whether an expression is `localStorage` or `sessionStorage`, with or
 * without `window.`.
 *
 * @param node - The expression.
 * @returns `true` when it is.
 */
export const isStorage = (node: Node): boolean =>
  (node.type === "Identifier" && STORAGE_NAMES.has(node.name)) ||
  (node.type === "MemberExpression" &&
    !node.computed &&
    node.object.type === "Identifier" &&
    GLOBAL_OBJECTS.has(node.object.name) &&
    node.property.type === "Identifier" &&
    STORAGE_NAMES.has(node.property.name));

/**
 * Finds the calls of a method on `localStorage` or `sessionStorage`.
 *
 * @param root - Where to look.
 * @param method - `getItem` or `setItem`.
 * @param options - See {@link FindOptions}.
 * @returns The calls.
 */
export const storageCalls = (
  root: Node,
  method: string,
  options?: FindOptions
): CallExpression[] =>
  methodCalls(root, method, options).filter(
    (call) =>
      call.callee.type === "MemberExpression" && isStorage(call.callee.object)
  );

/** A ref created with `useRef`. */
export interface RefDeclaration {
  /** The variable the ref is stored in. */
  name: string;
  /** The argument given to `useRef`. */
  init: Node | undefined;
}

/**
 * Finds the refs a function creates itself with `const name = useRef(...)`.
 *
 * @param fn - The function, such as a component or a custom hook.
 * @returns The refs in source order.
 */
export const refsOf = (fn: FunctionNode): RefDeclaration[] =>
  findAll(
    fn,
    (node): node is VariableDeclarator =>
      node.type === "VariableDeclarator" &&
      node.id.type === "Identifier" &&
      node.init?.type === "CallExpression" &&
      hookCallName(node.init) === "useRef",
    { nested: false }
  ).map((declarator) => ({
    name: (declarator.id as { name: string }).name,
    init: (declarator.init as CallExpression).arguments[0],
  }));

/**
 * Finds the assignments `name.current = ...` to a ref.
 *
 * @param root - Where to look.
 * @param name - The ref's variable name.
 * @param options - See {@link FindOptions}.
 * @returns The assignments.
 */
export const refAssignments = (
  root: Node,
  name: string,
  options?: FindOptions
): AssignmentExpression[] =>
  findAll(
    root,
    (node): node is AssignmentExpression =>
      node.type === "AssignmentExpression" &&
      node.operator === "=" &&
      referenceKey(node.left) === `${name}.current`,
    options
  );
