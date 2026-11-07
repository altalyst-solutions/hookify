import {
  SandpackCodeEditor,
  SandpackConsole,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from "@codesandbox/sandpack-react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useColorMode } from "@docusaurus/theme-common";
import React, { useEffect, useRef } from "react";

import localHookifySource from "!!raw-loader!@hookify-local-source";

import styles from "./styles.module.css";

// Pinned to a version inside the library's supported peer range (react/react-dom ^18.0.0 || ^19.0.0)
// so demos behave exactly like a real consumer's app, regardless of what
// version the Sandpack "react-ts" template defaults to.
const REACT_VERSION = "19.3.0";
const REACT_TYPES_VERSION = "19.3.0";
const REACT_DOM_TYPES_VERSION = "19.3.0";

// The `@altalyst/hookify` version demos install from npm comes from the
// `hookifyDemoVersion` custom field in docusaurus.config.ts: the exact release
// the stable docs were built from, or `latest` in local dev. The `next`
// channel injects the locally built library instead (see below).

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

// Chrome ignores the `allow` attribute Sandpack puts on the preview iframe for
// its first navigation, so `navigator.clipboard` fails inside demos with a
// permissions-policy error (https://crbug.com/414348233). Navigating the
// iframe once more after its first load makes the policy apply. The reload is
// harmless: Sandpack re-initializes the bundler when the iframe reloads.
const PreviewIframePermissions = ({
  container,
}: {
  container: React.RefObject<HTMLElement | null>;
}): null => {
  useEffect(() => {
    const iframes = Array.from(
      container.current?.querySelectorAll("iframe") ?? []
    );
    const cleanups = iframes.map((iframe) => {
      const onLoad = () => {
        iframe.removeEventListener("load", onLoad);
        const src = iframe.getAttribute("src");
        if (src) iframe.src = src;
      };
      iframe.addEventListener("load", onLoad);
      return () => iframe.removeEventListener("load", onLoad);
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [container]);
  return null;
};

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
 * On the stable docs, the demo runs the released `@altalyst/hookify` package
 * from npm, pinned to the version the docs were built from, so what consumers
 * see and edit is exactly what they'd get in their own app. On the `next`
 * docs, it runs the library built from the same commit as the docs.
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
  const { siteConfig } = useDocusaurusContext();
  const hookifyVersion = String(
    siteConfig.customFields?.hookifyDemoVersion ?? "latest"
  );
  const wrapperRef = useRef<HTMLDivElement>(null);
  const resolvedActiveFile = activeFile ?? Object.keys(files)[0];

  return (
    <BrowserOnly
      fallback={<div className={styles.fallback}>Loading demo…</div>}
    >
      {() => (
        <div className={styles.wrapper} ref={wrapperRef}>
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
                  : { "@altalyst/hookify": hookifyVersion }),
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
            <PreviewIframePermissions container={wrapperRef} />
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
