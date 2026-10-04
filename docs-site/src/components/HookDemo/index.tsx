import {
  SandpackCodeEditor,
  SandpackConsole,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from "@codesandbox/sandpack-react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import { useColorMode } from "@docusaurus/theme-common";
import React from "react";

import localHookifySource from "!!raw-loader!@hookify-local-source";

import styles from "./styles.module.css";

// Pinned to a version inside the library's supported peer range (react/react-dom ^18.0.0 || ^19.0.0)
// so demos behave exactly like a real consumer's app, regardless of what
// version the Sandpack "react-ts" template defaults to.
const REACT_VERSION = "18.3.1";
const REACT_TYPES_VERSION = "18.3.3";
const REACT_DOM_TYPES_VERSION = "18.3.0";

// Always resolves to the latest version published to npm, matching the
// "pull from npm CDN" approach: demos show the published library, not
// unreleased local changes.
const HOOKIFY_DEPENDENCY_VERSION = "latest";

// When the docs run with HOOKIFY_LOCAL=1, the locally built library is injected
// into the sandbox as a virtual `@altalyst/hookify` package, so unreleased
// hooks can be previewed before publishing. Empty otherwise.
const LOCAL_HOOKIFY_FILES: Record<string, string> = localHookifySource
  ? {
      "/node_modules/@altalyst/hookify/package.json": JSON.stringify({
        name: "@altalyst/hookify",
        version: "0.0.0-local",
        main: "./index.js",
      }),
      "/node_modules/@altalyst/hookify/index.js": localHookifySource,
    }
  : {};

export interface HookDemoProps {
  /**
   * Sandpack file map for a `react-ts` sandbox, e.g.
   * `{ "/App.tsx": "...", "/SearchInput.tsx": "..." }`.
   */
  files: Record<string, string>;
  /** Which file is open in the editor by default. */
  activeFile?: string;
  /** Extra npm dependencies beyond `@altalyst/hookify`, react and react-dom. */
  dependencies?: Record<string, string>;
  /** Show the embedded console panel (useful for hooks that log). */
  showConsole?: boolean;
  /** Show the file explorer sidebar (useful for multi-file demos). */
  showFileExplorer?: boolean;
  /** Height (px) of the editor/preview panes. Defaults to 400. */
  height?: number;
}

/**
 * Renders a live, editable Sandpack demo for a hookify hook.
 *
 * The demo runs the real `@altalyst/hookify` package resolved from npm, so
 * what consumers see and edit is exactly what they'd get in their own app.
 */
export default function HookDemo({
  files,
  activeFile,
  dependencies,
  showConsole = false,
  showFileExplorer = false,
  height = 400,
}: HookDemoProps): React.ReactElement {
  const { colorMode } = useColorMode();
  const resolvedActiveFile = activeFile ?? Object.keys(files)[0];

  return (
    <BrowserOnly
      fallback={<div className={styles.fallback}>Loading demo…</div>}
    >
      {() => (
        <div className={styles.wrapper}>
          <SandpackProvider
            template="react-ts"
            theme={colorMode === "dark" ? "dark" : "light"}
            files={{ ...LOCAL_HOOKIFY_FILES, ...files }}
            options={{
              activeFile: resolvedActiveFile,
              visibleFiles: Object.keys(files),
            }}
            customSetup={{
              dependencies: {
                ...(localHookifySource
                  ? {}
                  : { "@altalyst/hookify": HOOKIFY_DEPENDENCY_VERSION }),
                react: REACT_VERSION,
                "react-dom": REACT_VERSION,
                ...dependencies,
              },
              devDependencies: {
                "@types/react": REACT_TYPES_VERSION,
                "@types/react-dom": REACT_DOM_TYPES_VERSION,
              },
            }}
          >
            <SandpackLayout>
              {showFileExplorer && <SandpackFileExplorer />}
              <SandpackCodeEditor showLineNumbers showTabs style={{ height }} />
              <SandpackPreview
                style={{ height }}
                showOpenInCodeSandbox={false}
                showRefreshButton
              />
            </SandpackLayout>
            {showConsole && (
              <SandpackConsole
                style={{ height: 200 }}
                showHeader
                resetOnPreviewRestart
              />
            )}
          </SandpackProvider>
        </div>
      )}
    </BrowserOnly>
  );
}
