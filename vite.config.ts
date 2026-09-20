import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

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
      name: "hookify",
      fileName: "hookify",
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
    }),
  ],
});
