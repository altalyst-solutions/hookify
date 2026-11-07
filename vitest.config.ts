import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      pool: "threads",
      globals: true,
      setupFiles: "./tests/setup.ts",
      coverage: {
        provider: "v8",
        include: ["src/**/*.ts"],
        exclude: ["src/index.ts", "src/**/index.ts"],
        reporter: ["text", "html", "lcov"],
        thresholds: {
          lines: 95,
          statements: 95,
          functions: 95,
          branches: 90,
        },
      },
    },
  })
);
