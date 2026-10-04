# Release Process — Design

- **Date:** 2026-10-05
- **Status:** Draft
- **Linked issues:** #73 (release pipeline infra), #74 (status bar version), #75 (release skill)
- **Epic:** —
- **Related:** CI guard workflow (block non-release PRs to `main`, feature-64), GitHub Pages already live (`https://xledocteurx.github.io/river-king/`)

## Problem

The engine has no versioning or release mechanism: `package.json` is stuck at `0.0.0`, there
are no git tags or GitHub Releases, `main` only carries documentation commits, and the live
Pages site is served from an abandoned feature branch (`feature-11-tile-screen-rework`).
Publishing a first real release (`v0.1.0`) and iterating from there requires a reproducible,
professional pipeline that behaves identically whether driven by a human, by CI, or by an
OpenCode agent.

## User story

As the maintainer, when I want to ship a version, I follow one documented procedure (by hand
or delegated to an agent) that bumps the version, updates the changelog, merges through the
existing guard, tags the release, deploys the app to Pages, and drafts the Release notes —
without test suites going red and without the live site drifting from `main`.

## Design decisions

1. **SemVer, manual bump, single source of truth.** Versions follow `vX.Y.Z` (SemVer). The
   version lives only in `package.json`'s `version` field and is bumped manually on the
   release branch — no commit-message parsing, no auto-versioning, no convention change to
   the `feature-N:` commit prefix.
2. **Release branch + guarded PR.** Every release flows through `release/<x.y.z>` (from
   `develop`), a PR to `main` carrying the `release` label — the existing guard workflow is
   the gate, unchanged. This satisfies the protected-`main` model in AGENTS.md.
3. **Tag on `main`, after merge.** An annotated tag `vX.Y.Z` is created on `main` once the
   release PR is merged. Tags are the single trigger CI reacts to, so human-driven and
   agent-driven releases hit the same automation.
4. **CI deploys & drafts.** Pages source is switched once to **GitHub Actions**: a workflow
   builds with the production config and deploys the artifact on push to `main` **and** on
   tag pushes `v*`. A second workflow drafts the GitHub Release at each tag.
5. **Manual, versioned changelog.** `CHANGELOG.md` at the repo root, keep-a-changelog
   format, `Unreleased` section, entry added in the release PR. Release notes reference it.
6. **One agent-facing skill.** `.opencode/skills/release/SKILL.md` encodes the identical
   procedure (prechecks, branch, bump, PR label, tag, kanban) so a release is delegable.
7. **Version visible in-app.** The status bar right side shows `River King Engine — vX.Y.Z`,
   reading `package.json` at build time so it can never drift from the source of truth.

## Architecture

### Release conventions (single contract — shared by skill, runbook, and CI)

| Element        | Value                                       |
| -------------- | ------------------------------------------- |
| Version        | SemVer `vX.Y.Z`, source = `package.json`    |
| Release branch | `release/<x.y.z>` (from `develop`)          |
| Release PR     | `release/<x.y.z>` → `main`, label `release` |
| Tag            | annotated `vX.Y.Z`, created on `main`       |
| Changelog      | `CHANGELOG.md`, keep-a-changelog            |
| Deploy         | GitHub Pages, source _GitHub Actions_       |

### Deliverable 1 — `.github/workflows/deploy.yml` (issue #73)

- Triggers: `push: { branches: [main] }` and `push: { tags: ['v*'] }`.
- `build`: checkout → setup Node 22 (matches devbox pin) → `npm ci` → `npm run build`
  (production config).
- `deploy`: upload page artifact (`dist/river-king/browser`) →
  `actions/deploy-pages`. Requires Pages source _GitHub Actions_ (one-time manual settings
  callout, documented in the runbook).
- `permissions: { pages: write, id-token: write }`, `concurrency` guard for Pages.

### Deliverable 2 — `.github/workflows/release.yml` (issue #73)

- Triggers: `push: { tags: ['v*'] }`.
- Uses `softprops/action-gh-release` driving a **draft** release at the tag with
  `generate-notes: true` (GitHub lists merged PRs since the previous tag — deterministic,
  no changelog parsing in CI).

### Deliverable 3 — `CHANGELOG.md` (issue #73)

- keep-a-changelog scaffold with an `Unreleased` section and an entry template
  (`Added`/`Changed`/`Fixed`/`Removed`).

### Deliverable 4 — `docs/release-process.md` (issue #73)

Runbook, ~6 steps: prechecks (test/lint/build, CI green) → branch → bump → PR `release`
label → merge → tag → post-release (verify Pages deploy + draft notes, kanban Done).

### Deliverable 5 — `.opencode/skills/release/SKILL.md` (issue #75)

Frontmatter (`name: release`, `description`) + the same procedure as the runbook,
cross-referencing `ticket-management` for the kanban release card. The skill authoring
follows `writing-skills` conventions.

### Deliverable 6 — status bar version (issue #74)

- Read `version` from `package.json` via a typed import
  (`import { version } from '../../package.json'`); enable `resolveJsonModule` in
  `tsconfig.json` if not already set. Single source, no manual env sync.
- Export `APP_VERSION` from a tiny core module; render `River King Engine — vX.Y.Z` in the
  status bar right side (existing app-wide bar, right = brand label).
- If the JSON import proves problematic with the Angular builder, fallback: a one-liner in
  the build (Angular `fileReplacements`/env file) — rejected unless necessary, as it
  reintroduces sync drift.

## Release flow (same for runbook, skill, human, agent)

1. **Prechecks:** `npm run test`, `npm run lint`, `npm run build` green; `develop` green on CI.
2. `git checkout -b release/<x.y.z> develop`; bump `package.json` + add `[x.y.z]` changelog entry.
3. Open PR `release/<x.y.z>` → `main` with label `release`; guard passes; human merges.
4. On `main`: tag annotated `vX.Y.Z`; push tag.
5. CI: deploy Pages + draft GitHub Release.
6. Delete `release/<x.y.z>` (auto-delete), update kanban release card to Done.

## First release — `v0.1.0`

Shipped as soon as deliverables #73, #74, #75 are merged to `develop`. It publishes the
first real build of `main` (which currently lags `develop` by ~54 commits), tagging the
state including the demo seed. The status bar will read `River King Engine — v0.1.0`.

## Acceptance (mapped to the issues)

- #73: Pages source = Actions; deploy on `main` push + `v*` tags; release draft per tag;
  `CHANGELOG.md` scaffolded; runbook written; guard unaffected.
- #74: status bar shows `River King Engine — vX.Y.Z` from `package.json`; dev + prod
  identical; design-system compliant; lint/test/format green.
- #75: `release` skill exists with valid frontmatter, matches the runbook, links
  `ticket-management`.
