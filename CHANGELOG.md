# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

Releases are managed with [Changesets](https://github.com/changesets/changesets)
(see [CONTRIBUTING.md](./CONTRIBUTING.md#commit-messages-and-versioning)).
Each PR that changes the published package includes a changeset describing
the bump and the change; merging the resulting "Version Packages" pull
request bumps the version, appends a new section below (grouped by `Major
Changes` / `Minor Changes` / `Patch Changes`, each linking back to its PR),
and publishes to npm. Entries below this point are written by Changesets
rather than by hand. For the full list of published versions, see the
[npm version history](https://www.npmjs.com/package/@altalyst/hookify?activeTab=versions)
or the [GitHub tags](https://github.com/altalyst-solutions/hookify/tags)
(tags from `0.5.1` and earlier have no `v` prefix, e.g. `0.4.0`; tags from
`0.6.0` onward are named `v<version>`, e.g. `v0.6.0`).

## 0.8.1

### Patch Changes

- [#68](https://github.com/altalyst-solutions/hookify/pull/68) [`0f3cbe1`](https://github.com/altalyst-solutions/hookify/commit/0f3cbe13a65cf97240320da545eec1d77a648972) Thanks [@sleepinzombie](https://github.com/sleepinzombie)! - Stop writing to or reading refs during render in `useMounted`, `useControlledState` and `useAutofillSubmit`, and stop setting state synchronously inside an effect in `useApi`, so the hooks are safe under concurrent rendering and the React Compiler. Behaviour is otherwise unchanged; `useApi` now also resets to `loading` immediately when the URL or options change.

  `useApi` also no longer refetches in a loop when `headers` is passed as an inline object; headers are now compared by value.

## 0.8.0

### Minor Changes

- [#64](https://github.com/altalyst-solutions/hookify/pull/64) [`64f09ca`](https://github.com/altalyst-solutions/hookify/commit/64f09cabce9e3cc73585b47b7026981af9da0203) Thanks [@sleepinzombie](https://github.com/sleepinzombie)! - Support React 19 alongside React 18. The `react` and `react-dom` peer dependency range is now `^18.0.0 || ^19.0.0`, and a couple of hook signatures were adjusted to type-check against both `@types/react` 18 and 19.

### Patch Changes

- [#64](https://github.com/altalyst-solutions/hookify/pull/64) [`ad20bf2`](https://github.com/altalyst-solutions/hookify/commit/ad20bf2562c8a0aa3ec4596bf0ec141b2b94a32c) Thanks [@sleepinzombie](https://github.com/sleepinzombie)! - Fix `useEffectAfterMount` calling its callback on the initial mount when rendered inside React `StrictMode`.

## 0.7.0

### Minor Changes

- [#61](https://github.com/altalyst-solutions/hookify/pull/61) [`ccfd349`](https://github.com/altalyst-solutions/hookify/commit/ccfd34967247fb9ac4a9aa4ee490d25cf54830fa) Thanks [@sleepinzombie](https://github.com/sleepinzombie)! - Improve package output for bundlers and Node. The UMD build (`hookify.umd.cjs`) is replaced by a CommonJS build (`hookify.cjs`) alongside the ES module build, a `.d.cts` types file is now shipped for CommonJS consumers, and an `exports` map plus `"sideEffects": false` are added so unused hooks are reliably tree-shaken. Script-tag usage via the global `hookify` is no longer available; use an ESM CDN or an import map instead.

## 0.6.0

### Minor Changes

- [#59](https://github.com/altalyst-solutions/hookify/pull/59) [`70ae856`](https://github.com/altalyst-solutions/hookify/commit/70ae856d8e782d4d2fdacefbe7164520278cfc8e) Thanks [@sleepinzombie](https://github.com/sleepinzombie)! - Add `useAutofillSubmit`, a hook that submits a form as soon as a password manager fills it. It is fully typed (field names are inferred as literals) and configurable through `enabled`, `pollInterval`, `interactionEvents`, `requireInteraction`, `isFilled`, `onAutofill` (can veto) and `submit`, and returns `rearm`, `disarm` and `isArmed` controls.

## 0.5.5

### Patch Changes

- [#54](https://github.com/altalyst-solutions/hookify/pull/54) [`09fc901`](https://github.com/altalyst-solutions/hookify/commit/09fc9012aa5d0cfec6941145f78c5c64d09afbc0) Thanks [@sleepinzombie](https://github.com/sleepinzombie)! - Fix `react-hooks/exhaustive-deps` issues in `useApi` and `useMounted`. `useApi`'s `refetch` now keeps a stable identity until `url`, `method`, `headers`, or `body` change, and `useMounted` now calls the latest `onMount`/`onUnmount` callbacks instead of the ones from the first render.

## 0.5.4

### Patch Changes

- [#50](https://github.com/altalyst-solutions/hookify/pull/50) [`6de3e7e`](https://github.com/altalyst-solutions/hookify/commit/6de3e7e46893dc1a9173f000aa69a9acf0adc7df) Thanks [@sleepinzombie](https://github.com/sleepinzombie)! - Use the default `GITHUB_TOKEN` for the release workflow now that branch protection only targets `main`, instead of a personal-account PAT. Release pull requests, commits, and tags will now be attributed to `github-actions[bot]`.

## 0.5.3

### Patch Changes

- [#48](https://github.com/altalyst-solutions/hookify/pull/48) [`2f47515`](https://github.com/altalyst-solutions/hookify/commit/2f47515e0d20a3c07ce9516f7ea0c7d62165b484) Thanks [@sleepinzombie](https://github.com/sleepinzombie)! - Fix release automation so published versions correctly get a git tag and GitHub release. `changesets/action@v1` detected releases by matching a CLI output string that `@changesets/cli@3.0.3` no longer prints, silently skipping the tag/release step; upgrading to `changesets/action@v2` fixes this.

## 0.5.2

### Patch Changes

- [#46](https://github.com/altalyst-solutions/hookify/pull/46) [`8baf00f`](https://github.com/altalyst-solutions/hookify/commit/8baf00fffc6fc735218fec7f00b2906951f5d56b) Thanks [@sleepinzombie](https://github.com/sleepinzombie)! - Add npm package metadata (`description`, `keywords`, `homepage`, `bugs`, `author`) to improve discoverability on npm and GitHub.

## 0.5.1 - 2026-09-24

### Changed

- Add prepare-pr skill and document it in CONTRIBUTING
- Add follow-up PR detection to prepare-pr skill
- Separate PR title from body in prepare-pr skill

## 0.5.0 - 2026-09-24

### Changed

- Add MIT license
- Rewrite README with badges, features, and hook reference
- Add contributing guide, code of conduct, security policy, and changelog
- Add issue and pull request templates
- Fix stale hook demo and API reference links in getting started guide
- Automate CHANGELOG.md updates on release

## 0.4.0

### Added

- `useApi`, `useControlledState`, `useDebounce`, `useDocVisible`,
  `useEffectAfterMount`, `useMounted`, `useOutsideClick`,
  `usePersistedState`, `useSequentialRequest`, and `useToggleState` hooks.
- Docusaurus documentation site with live, editable demos and a
  TypeDoc-generated API reference for every hook.

[0.5.1]: https://github.com/altalyst-solutions/hookify/compare/0.5.0...0.5.1
[0.5.0]: https://github.com/altalyst-solutions/hookify/compare/0.4.0...0.5.0
[0.4.0]: https://github.com/altalyst-solutions/hookify/releases/tag/0.4.0
