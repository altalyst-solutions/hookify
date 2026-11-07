# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Installation

```bash
npm install
```

**Note**: feel free to use the package manager of your choice.

## Local Development

```bash
npm run start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Previewing unreleased hooks in live demos

By default, `HookDemo` runs the **published** `@altalyst/hookify` from npm, so new or changed hooks don't appear in demos until released. To run demos against the local library build, from the repository root:

```bash
npm run docs:dev:local   # builds the library, then starts the docs with HOOKIFY_LOCAL=1
npm run watch            # optional, in another terminal: rebuild on changes
```

With `HOOKIFY_LOCAL=1`, `docusaurus.config.ts` aliases `@hookify-local-source` to `../dist/hookify.js`, and `HookDemo` injects it into the sandbox as a virtual `@altalyst/hookify` package. Without it the alias points to an empty file and the npm version is used. Edits to `src/` reach the demos only while `npm run watch` is running. The build cache is kept separately for each demo source, so switching between `docs:dev` and `docs:dev:local` never serves the other mode's demos.

### Editor types for `@altalyst/hookify`

`docs-site/tsconfig.json` maps `@altalyst/hookify` to the local `../dist/index.d.ts`, so example components (and `npm run typecheck`) see the current API, including unreleased hooks, instead of the npm release's types. Run `npm run build` in the repository root first (or keep `npm run watch` running); without `dist/` the import can't be resolved. This only affects type-checking, not the Docusaurus bundle or the demos.

## Build

```bash
npm run build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

Deployment is automatic; don't run `npm run deploy`. [`.github/workflows/docs-deploy.yml`](../.github/workflows/docs-deploy.yml) publishes two channels to one GitHub Pages site:

| Channel | URL                                                | Built from                    | Demos run                              |
| ------- | -------------------------------------------------- | ----------------------------- | -------------------------------------- |
| Stable  | https://altalyst-solutions.github.io/hookify/      | The latest GitHub release tag | That exact version from npm            |
| Next    | https://altalyst-solutions.github.io/hookify/next/ | `main`                        | The library built from the same commit |

Next shows an "unreleased" banner and is hidden from search engines. Both channels have a version menu that links to the other one.

- **Push to `main`** (changes under `src/` or `docs-site/`): rebuilds next. Stable is reused as built.
- **Release:** after Changesets publishes to npm, `ci.yml` calls the docs workflow, which builds stable from the new tag and attaches it to the GitHub release as `docs-stable.tar.gz`. Later deploys download that file instead of rebuilding stable.
- **Manual:** run the "Deploy Docs" workflow from the Actions tab. Tick "Rebuild the stable docs" to rebuild stable from its tag instead of reusing the attached build.

GitHub Pages replaces the whole site on every deploy, which is why each deploy uploads both channels.

To build a channel locally the way CI does, set `DOCS_CHANNEL` (`stable` or `next`) and `HOOKIFY_STABLE_VERSION` (the latest release, such as `0.12.0`). The next channel needs `npm run build` first, because its demos use `../dist/hookify.js`:

```bash
npm run build
DOCS_CHANNEL=next HOOKIFY_STABLE_VERSION=0.12.0 npm run docs:build
```

Without these variables the build is a stable build whose demos use the `latest` npm release, as in local development.
