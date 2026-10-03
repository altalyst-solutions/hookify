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

With `HOOKIFY_LOCAL=1`, `docusaurus.config.ts` aliases `@hookify-local-source` to `../dist/hookify.js`, and `HookDemo` injects it into the sandbox as a virtual `@altalyst/hookify` package. Without it the alias points to an empty file and the npm version is used. Edits to `src/` reach the demos only while `npm run watch` is running.

## Build

```bash
npm run build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

Using SSH:

```bash
USE_SSH=true npm run deploy
```

Not using SSH:

```bash
GIT_USER=<Your GitHub username> npm run deploy
```

If you are using GitHub Pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.
