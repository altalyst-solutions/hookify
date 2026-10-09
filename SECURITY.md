# Security Policy

## Supported Versions

Hookify follows [semantic versioning](https://semver.org/) and publishes a
single, continuously released line on npm. Only the latest published version
is supported with security fixes.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| Older   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Hookify, please **do not** open a
public issue. Instead, report it privately using
[GitHub's private vulnerability reporting](https://github.com/altalyst-solutions/hookify/security/advisories/new)
for this repository.

Please include as much detail as possible:

- A description of the vulnerability and its potential impact
- Steps to reproduce, or a minimal repro repository/snippet
- The affected version(s) of `@altalyst/hookify`

We aim to acknowledge reports within 5 business days, and to release a fix
(or provide a mitigation plan) as soon as reasonably possible depending on
severity. We'll keep you updated throughout the process and credit you in the
release notes, unless you'd prefer to remain anonymous.

## Known Advisories in Development Dependencies

The documentation site (`docs-site/`) is built with Docusaurus and is not part
of the published `@altalyst/hookify` package. `npm audit` in `docs-site/`
currently reports high-severity findings that all trace back to
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), a
stack-exhaustion denial of service in `braces` (all versions through 3.0.3,
with no patched release available). The affected packages (`micromatch`,
`fast-glob`, `globby`, `@docusaurus/*`, etc.) are only flagged because they
depend on `braces`.

`npm audit` in `docs-site/` also reports moderate findings for
[GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf), a
quadratic-complexity CPU exhaustion in `postcss-selector-parser` below 7.1.6.
The remaining vulnerable 6.x copy is pinned by Docusaurus's `cssnano` toolchain
(`cssnano-preset-advanced` and several `postcss-*` plugins require `^6`), so it
cannot be upgraded without forcing an incompatible major version. It only parses
our own CSS at build time. `tinypool` (Docusaurus's build worker pool) is
pinned to a patched 2.x release through an `overrides` entry in
`docs-site/package.json`; remove that override once Docusaurus ships a release
that depends on a patched `tinypool` itself.

We accept this risk for now: `braces` only runs at build and dev time against
glob patterns from our own configuration and files, and it does not ship in
the built site or in the library. We re-check `npm audit` periodically and
will update as soon as a patched `braces` or Docusaurus release is available.

`npm audit` at the repository root reports moderate findings that trace back
to [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), a
denial of service in `sprintf-js` (all versions through 1.1.3, with no patched
release available). It is pulled in only through `@microsoft/api-extractor`
(used by `vite-plugin-dts` to generate type declarations at build time), so
`@rushstack/ts-command-line`, `argparse` and `@microsoft/api-extractor` are
flagged transitively. It is not part of the published package's runtime
dependencies, and we accept it until a patched release is available.
