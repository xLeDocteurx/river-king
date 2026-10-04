# Show App Version in Status Bar — Design

**Issue:** #74 — Show the app version in the status bar (River King Engine — vX.Y.Z)
**Date:** 2026-10-05
**Status:** Approved (part of release-process design, validated as optional objective #74)

## Context

During a release the app must visibly expose its version. Today the right side of the
app-wide status bar is a static literal `River King Engine` (`app.component.html:74`),
while the version lives only in `package.json` (`"version": "0.0.0"`) — the single
source of truth per the release-process conventions (spec
`2026-10-05-release-process-design.md`).

## Proposed behavior

The status bar's right label becomes `River King Engine — vX.Y.Z`, where `X.Y.Z` is read
from `package.json` at build time. Nothing else in the app changes; the topbar brand
stays as-is.

## Acceptance criteria

- [ ] Status bar right side shows `River King Engine — vX.Y.Z` using the version from `package.json`
- [ ] Identical output in dev (`ng serve`) and production build
- [ ] Design-system compliant (11px, primary bar, arrow dash `—` not em-dash rendering issue)
- [ ] lint / format / unit tests stay green; no bundle budget regression

## Design decisions

1. **Source of truth:** `package.json` `version` field, imported at build time —
   `import { version } from '../../package.json'`. This keeps a single source and stays
   in sync with the release runbook's bump step (`docs/release-process.md` Step 2).
2. **Access point:** new tiny core module `src/app/core/app-version.ts` exporting
   `export const APP_VERSION = version;` with a `@deprecated`-free JSDoc stating the
   provenance. One import site in the root app template (`AppComponent`), matching the
   status-bar ownership rule (right side is root-owned per `status-bar.service.ts` JSDoc).
3. **Tooling:** esbuild (Angular application builder and the Vitest unit-test builder)
   resolves JSON imports natively. TypeScript needs `resolveJsonModule: true`, added to
   the base `tsconfig.json` so both `tsconfig.app.json` and `tsconfig.spec.json` inherit it.
4. **Testing:** the value is static, so the meaningful spec is that the footer renders
   exactly `River King Engine — v0.0.0` (matches `package.json`); assert via the existing
   status-bar footer test, computing the expected string from the same imported version
   to avoid encoding the test value twice.
5. **No runtime config / fetch:** build-time import only — dev and prod ship the bundled
   string, so they are identical by construction.
6. **Out of scope:** displaying the version anywhere else (issue #3's utility status bar
   is its own thing), a version endpoint, or semver ranges.

## Risks & mitigations

- If a future Angular builder dropped JSON named imports, fallbacks (in order): Angular
  `define`/text-replacement in `angular.json`, a tiny generated `app-version.ts` from a
  prebuild script reading `package.json`. Not needed today — esbuild confirms support.
