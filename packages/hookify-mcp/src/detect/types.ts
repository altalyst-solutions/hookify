import type { File } from "@babel/types";

/**
 * How sure a detector is that a hook fits the code it found.
 *
 * - `high`: the whole hand-written pattern is there, including its cleanup.
 * - `medium`: part of it is there, or the hook is one of several that could fit.
 */
export type Confidence = "high" | "medium";

/** A position in the source. Both numbers start at 1. */
export interface SourcePosition {
  /** The line. */
  line: number;
  /** The column. */
  column: number;
}

/** A span of source code, from `start` up to the end of `end`. */
export interface SourceRange {
  /** Where the code starts. */
  start: SourcePosition;
  /** The position just after the last character of the code. */
  end: SourcePosition;
}

/** The hand-written patterns the detectors know, one id per detector. */
export type PatternId =
  | "event-listener-in-effect"
  | "interval-in-effect"
  | "intersection-observer-in-effect"
  | "resize-observer-in-effect"
  | "match-media-listener"
  | "storage-mirrored-state"
  | "debounced-value-in-effect"
  | "debounced-callback"
  | "throttled-callback"
  | "previous-value-ref"
  | "mounted-ref";

/** One place where a hookify hook could replace hand-written code. */
export interface Finding {
  /** The hook that could replace the code, such as `useInterval`. */
  hook: string;
  /** Which pattern was found. */
  pattern: PatternId;
  /** How sure the detector is. */
  confidence: Confidence;
  /** One sentence on what the code does and why the hook fits. */
  reason: string;
  /** The code that the hook would replace. */
  range: SourceRange;
}

/** Finds one kind of hand-written pattern in a parsed file. */
export interface Detector {
  /** The pattern it finds. */
  pattern: PatternId;
  /** Every hook it can suggest, which tests check against the hook data. */
  hooks: readonly string[];
  /**
   * Finds the pattern.
   *
   * @param ast - The parsed file.
   * @returns One finding for each place the pattern appears.
   */
  detect(ast: File): Finding[];
}

/** What {@link detectPatterns} returns. */
export interface DetectResult {
  /** Every finding, in source order. */
  findings: Finding[];
  /** Why the code couldn't be parsed. Set only when `findings` is empty because of it. */
  parseError?: string;
}

/** Options for {@link detectPatterns}. */
export interface DetectOptions {
  /**
   * The file's name, such as `Search.tsx`. Its extension decides whether JSX is
   * parsed. Default is to try JSX with TypeScript, then TypeScript alone.
   */
  filename?: string;
}
