import { findEffects, globalCalls, makeFinding } from "../ast.ts";
import type { Detector, Finding } from "../types.ts";

/** The hand-written `setInterval` in an effect that `useInterval` replaces. */
export const intervalInEffect: Detector = {
  pattern: "interval-in-effect",
  hooks: ["useInterval"],
  detect: (ast) => {
    const findings: Finding[] = [];

    for (const effect of findEffects(ast)) {
      if (globalCalls(effect.callback, "setInterval").length === 0) continue;
      const cleared = globalCalls(effect.callback, "clearInterval").length > 0;

      findings.push(
        makeFinding(
          "interval-in-effect",
          "useInterval",
          cleared ? "high" : "medium",
          cleared
            ? "Starts a setInterval in an effect and clears it in the cleanup; useInterval does both, calls the latest callback and pauses when the delay is null."
            : "Starts a setInterval in an effect and never clears it; useInterval clears it on unmount, calls the latest callback and pauses when the delay is null.",
          effect.call
        )
      );
    }
    return findings;
  },
};
