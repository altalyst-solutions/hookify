import { defineConfig, mergeConfig } from "vitest/config";

import coverageThresholds from "./tests/coverage-thresholds.json" with { type: "json" };
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      pool: "threads",
      isolate: false,
      unstubGlobals: true,
      unstubEnvs: true,
      restoreMocks: true,
      globals: true,
      setupFiles: "./tests/setup.ts",
      coverage: {
        provider: "v8",
        include: ["src/**/*.ts"],
        exclude: ["src/index.ts", "src/**/index.ts"],
        // `json-summary` feeds the coverage table in the PR check job summary.
        reporter: ["text", "html", "lcov", "json-summary"],
        thresholds: coverageThresholds,
      },
    },
  })
);
