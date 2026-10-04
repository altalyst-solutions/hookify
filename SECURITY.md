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

We accept this risk for now: `braces` only runs at build and dev time against
glob patterns from our own configuration and files, and it does not ship in
the built site or in the library. We re-check `npm audit` periodically and
will update as soon as a patched `braces` or Docusaurus release is available.
The library itself (`npm audit` at the repository root) reports no
vulnerabilities.
