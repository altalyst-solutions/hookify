import path from "node:path";

import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import type TypedocPlugin from "docusaurus-plugin-typedoc";

const typedocOptions: Parameters<typeof TypedocPlugin>[1] = {
  entryPoints: ["../src/index.ts"],
  tsconfig: "../tsconfig.app.json",
  compilerOptions: {
    types: ["node"],
  },
  out: "docs/api",
  readme: "none",
  sidebar: {
    autoConfiguration: true,
    pretty: true,
    typescript: false,
    deprecatedItemClassName: "typedoc-sidebar-item-deprecated",
  },
  excludeExternals: true,
  excludePrivate: true,
  excludeProtected: true,
  hidePageHeader: true,
};

/**
 * The docs are published as two channels on one GitHub Pages site:
 *
 * - `stable` (the default), at `/hookify/`: built from the latest release tag.
 *   Demos install that exact version from npm.
 * - `next`, at `/hookify/next/`: built from `main`. Demos run the library built
 *   from the same commit, so unreleased hooks can be previewed. It shows an
 *   "unreleased" banner and is hidden from search engines.
 *
 * `DOCS_CHANNEL` picks the channel. `HOOKIFY_STABLE_VERSION` is the latest
 * released version (such as `0.12.0`): stable demos install it from npm and
 * both channels show it in the version menu. When unset, for example in local
 * dev, demos install `latest`. See .github/workflows/docs-deploy.yml for how
 * both channels are built and deployed.
 */
const channel = process.env.DOCS_CHANNEL === "next" ? "next" : "stable";
const isNext = channel === "next";
const stableVersion = process.env.HOOKIFY_STABLE_VERSION || undefined;
const stableLabel = stableVersion ? `v${stableVersion}` : "Stable";

const STABLE_BASE_URL = "/hookify/";
const NEXT_BASE_URL = "/hookify/next/";

/**
 * A version-menu entry that links to the other channel. Docusaurus prefixes
 * every navbar `to`/`href` (even `pathname://` ones) with the current base URL,
 * which would turn `/hookify/` into `/hookify/next/hookify/` on the next
 * channel, so the entry is a plain `<a>` that Docusaurus leaves alone.
 *
 * @param label - The text shown in the menu.
 * @param href - The channel's base URL, such as `/hookify/next/`.
 * @param active - Whether this is the channel being viewed.
 * @returns A navbar `html` item for the dropdown.
 */
const channelMenuItem = (label: string, href: string, active: boolean) => ({
  type: "html" as const,
  value: `<a class="dropdown__link${
    active ? " dropdown__link--active" : ""
  }" href="${href}">${label}</a>`,
});

// Set HOOKIFY_LOCAL=1 (see `npm run docs:dev:local`) to run live demos against
// the locally built library in ../dist instead of the version published to npm.
// The `next` channel always does, since its hooks may not be released yet.
const useLocalHookify = isNext || process.env.HOOKIFY_LOCAL === "1";

const config: Config = {
  title: "Hookify",
  tagline: "A collection of React hooks that just work.",
  favicon: "img/favicon.ico",
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },
  url: "https://altalyst-solutions.github.io",
  baseUrl: isNext ? NEXT_BASE_URL : STABLE_BASE_URL,
  // Keep the unreleased docs out of search results so they never compete
  // with the stable pages.
  noIndex: isNext,

  // Read by HookDemo to pick which `@altalyst/hookify` the demos install.
  customFields: {
    docsChannel: channel,
    hookifyDemoVersion: stableVersion ?? "latest",
  },

  // GitHub pages deployment config.
  organizationName: "altalyst-solutions",
  projectName: "hookify",

  onBrokenLinks: "throw",

  plugins: [
    ["docusaurus-plugin-typedoc", typedocOptions],
    () => ({
      name: "hookify-local-demo-source",
      configureWebpack: (config) => {
        // Docusaurus's persistent cache version ignores plugin aliases, so a
        // cache warmed by one demo source would keep serving it after
        // switching (for example `docs:dev` then `docs:dev:local`, or the
        // stable and next builds). Key the cache by the demo source too.
        const demoSource = useLocalHookify ? "local" : "npm";
        const caches = [
          config.cache,
          (config.experiments as { cache?: unknown } | undefined)?.cache,
        ];
        for (const cache of caches) {
          if (cache && typeof cache === "object" && "version" in cache) {
            cache.version = `${String(cache.version)}-demo-${demoSource}`;
          }
        }

        return {
          resolve: {
            alias: {
              // Resolved by HookDemo; empty source means "use the npm version".
              "@hookify-local-source": useLocalHookify
                ? path.resolve(__dirname, "../dist/hookify.js")
                : path.resolve(__dirname, "src/components/HookDemo/empty.js"),
            },
          },
        };
      },
    }),
  ],

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "/",
          editUrl:
            "https://github.com/altalyst-solutions/hookify/tree/main/docs-site/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/docusaurus-social-card.jpg",
    ...(isNext && {
      announcementBar: {
        id: "next-docs",
        content: `You're viewing the docs for the next, unreleased version of Hookify. <a href="${STABLE_BASE_URL}">Go to the stable docs</a>.`,
        isCloseable: false,
      },
    }),
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Hookify",
      logo: {
        alt: "Hookify Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Docs",
        },
        {
          type: "docSidebar",
          sidebarId: "apiSidebar",
          position: "left",
          label: "API Reference",
        },
        {
          type: "dropdown",
          label: isNext ? "Next" : stableLabel,
          position: "right",
          items: [
            channelMenuItem(
              `${stableLabel} (latest release)`,
              STABLE_BASE_URL,
              !isNext
            ),
            channelMenuItem("Next (unreleased)", NEXT_BASE_URL, isNext),
          ],
        },
        {
          href: "https://www.npmjs.com/package/@altalyst/hookify",
          label: "npm",
          position: "right",
        },
        {
          href: "https://github.com/altalyst-solutions/hookify",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Getting Started",
              to: "/getting-started",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "GitHub Discussions",
              href: "https://github.com/altalyst-solutions/hookify/discussions",
            },
            {
              label: "Issues",
              href: "https://github.com/altalyst-solutions/hookify/issues",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "npm",
              href: "https://www.npmjs.com/package/@altalyst/hookify",
            },
            {
              label: "GitHub",
              href: "https://github.com/altalyst-solutions/hookify",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Altalyst Solutions. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
