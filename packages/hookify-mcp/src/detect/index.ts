import { parse, type ParserPlugin } from "@babel/parser";
import type { File } from "@babel/types";

import { eventListenerInEffect } from "./detectors/event-listener.ts";
import { intervalInEffect } from "./detectors/interval.ts";
import { matchMediaListener } from "./detectors/match-media.ts";
import {
  intersectionObserverInEffect,
  resizeObserverInEffect,
} from "./detectors/observers.ts";
import { mountedRef, previousValueRef } from "./detectors/refs.ts";
import { storageMirroredState } from "./detectors/storage.ts";
import {
  debouncedCallback,
  debouncedValueInEffect,
  throttledCallback,
} from "./detectors/timing.ts";
import type {
  DetectOptions,
  Detector,
  DetectResult,
  Finding,
} from "./types.ts";

export type * from "./types.ts";

/** Every detector, in the order their findings are produced before sorting. */
export const DETECTORS: readonly Detector[] = [
  eventListenerInEffect,
  intervalInEffect,
  intersectionObserverInEffect,
  resizeObserverInEffect,
  matchMediaListener,
  storageMirroredState,
  debouncedValueInEffect,
  debouncedCallback,
  throttledCallback,
  previousValueRef,
  mountedRef,
];

/** Extensions that can't contain JSX, where `<T>value` is a type assertion. */
const NO_JSX = /\.(?:ts|mts|cts)$/i;

/**
 * Parses source code as TypeScript, with JSX where the file name allows it.
 *
 * @param code - The source.
 * @param filename - The file's name, if known.
 * @returns The parsed file. It throws a `SyntaxError` when the code can't be
 *   parsed as TypeScript, with or without JSX.
 */
const parseSource = (code: string, filename: string | undefined): File => {
  const attempts: ParserPlugin[][] =
    filename === undefined
      ? [["jsx", "typescript"], ["typescript"]]
      : NO_JSX.test(filename)
        ? [["typescript"]]
        : [["jsx", "typescript"]];

  let failure: unknown;
  for (const plugins of attempts) {
    try {
      return parse(code, {
        sourceType: "module",
        plugins: [...plugins, "decorators-legacy"],
        errorRecovery: true,
        allowReturnOutsideFunction: true,
        allowAwaitOutsideFunction: true,
        allowUndeclaredExports: true,
      });
    } catch (error) {
      failure ??= error;
    }
  }
  throw failure;
};

/**
 * Finds hand-written code that a hookify hook could replace.
 *
 * The code is parsed, not run, so it can be a whole file or a fragment such as
 * one component. It never throws: code that can't be parsed gives no findings
 * and a `parseError`.
 *
 * @param code - The source code.
 * @param options - See {@link DetectOptions}.
 * @returns The findings in source order, and a `parseError` if the code
 *   couldn't be parsed.
 */
export const detectPatterns = (
  code: string,
  options: DetectOptions = {}
): DetectResult => {
  let ast: File;
  try {
    ast = parseSource(code, options.filename);
  } catch (error) {
    return {
      findings: [],
      parseError: error instanceof Error ? error.message : String(error),
    };
  }

  const findings: Finding[] = [];
  try {
    for (const detector of DETECTORS) findings.push(...detector.detect(ast));
  } catch (error) {
    // Code nested deeply enough to overflow the stack can't be analyzed.
    if (error instanceof RangeError) {
      return { findings: [], parseError: "The code is nested too deeply." };
    }
    throw error;
  }

  findings.sort(
    (a, b) =>
      a.range.start.line - b.range.start.line ||
      a.range.start.column - b.range.start.column ||
      a.pattern.localeCompare(b.pattern)
  );
  return { findings };
};
