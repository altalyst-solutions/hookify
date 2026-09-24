# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

Versions are published automatically on every merge to `main` (see
[CONTRIBUTING.md](./CONTRIBUTING.md#commit-messages-and-versioning)). The
`## [Unreleased]` section below is populated automatically by CI from commit
messages right after each release, so it should normally stay empty between
releases. For the full list of published versions, see the
[npm version history](https://www.npmjs.com/package/@altalyst/hookify?activeTab=versions)
or the [GitHub tags](https://github.com/altalyst-solutions/hookify/tags) (tags
have no `v` prefix, e.g. `0.4.0`).

## [Unreleased]

## [0.5.1] - 2026-09-24

### Changed

- Add prepare-pr skill and document it in CONTRIBUTING
- Add follow-up PR detection to prepare-pr skill
- Separate PR title from body in prepare-pr skill

## [0.5.0] - 2026-09-24

### Changed

- Add MIT license
- Rewrite README with badges, features, and hook reference
- Add contributing guide, code of conduct, security policy, and changelog
- Add issue and pull request templates
- Fix stale hook demo and API reference links in getting started guide
- Automate CHANGELOG.md updates on release

## [0.4.0]

### Added

- `useApi`, `useControlledState`, `useDebounce`, `useDocVisible`,
  `useEffectAfterMount`, `useMounted`, `useOutsideClick`,
  `usePersistedState`, `useSequentialRequest`, and `useToggleState` hooks.
- Docusaurus documentation site with live, editable demos and a
  TypeDoc-generated API reference for every hook.

[unreleased]: https://github.com/altalyst-solutions/hookify/compare/0.5.1...HEAD
[0.5.1]: https://github.com/altalyst-solutions/hookify/compare/0.5.0...0.5.1
[0.5.0]: https://github.com/altalyst-solutions/hookify/compare/0.4.0...0.5.0
[0.4.0]: https://github.com/altalyst-solutions/hookify/releases/tag/0.4.0
