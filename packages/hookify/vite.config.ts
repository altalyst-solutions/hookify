import { copyFileSync } from "fs";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const outDir = resolve(import.meta.dirname, "dist");

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    copyPublicDir: false,
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "hookify.js" : "hookify.cjs"),
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
  },
  plugins: [
    dts({
      tsconfigPath: resolve(import.meta.dirname, "tsconfig.app.json"), // A hack in the latest Vite version as explained here: https://github.com/qmhc/vite-plugin-dts/issues/344#issuecomment-2223439526
      bundleTypes: true, // renamed from `rollupTypes` in vite-plugin-dts v5
      afterBuild: () => {
        // CJS consumers need a `.d.cts` so TypeScript treats the types as CommonJS
        copyFileSync(
          resolve(outDir, "index.d.ts"),
          resolve(outDir, "index.d.cts")
        );
      },
    }),
  ],
});
