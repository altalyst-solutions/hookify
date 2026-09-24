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

const config: Config = {
  title: "Hookify",
  tagline: "A collection of React hooks that just work.",
  favicon: "img/favicon.ico",
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },
  url: "https://altalyst-solutions.github.io",
  baseUrl: "/hookify/",

  // GitHub pages deployment config.
  organizationName: "altalyst-solutions",
  projectName: "hookify",

  onBrokenLinks: "throw",

  plugins: [["docusaurus-plugin-typedoc", typedocOptions]],

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
