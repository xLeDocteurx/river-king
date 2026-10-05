---
name: release
description: Use when cutting a River King release — bumping the version, updating CHANGELOG.md, opening the release PR to main, tagging vX.Y.Z, and syncing develop back. Relevant whenever the user asks to release, publish a version, ship, or tag, or mentions release/x.y.z, the release label, or the release PR.
---

# Release

Drive one release end to end. **The process is defined in
[`docs/release-process.md`](../../../docs/release-process.md)** — read it first and follow
it; this skill carries the executable sequence so an agent cannot skip a step.

## Input

The target version `X.Y.Z` (SemVer, no `v` prefix on the branch, `vX.Y.Z` on the tag).
Confirm it with the user before starting if they did not state it.

## Conventions (verify against the runbook table)

| Element        | Value                                      |
| -------------- | ------------------------------------------ |
| Version source | `package.json`                             |
| Release branch | `release/x.y.z` created from `develop`     |
| Release PR     | `release/x.y.z` -> `main`, label `release` |
| Tag            | Annotated `vX.Y.Z` on `main`               |
| Changelog      | `CHANGELOG.md` (keep-a-changelog)          |

## Step 0 — Prechecks (blocking)

Stop and report if any fails.

```bash
devbox run npm run test
devbox run npm run lint
devbox run npm run build
git status --short   # must be empty
```

`develop` must be green on CI (required `check` status) and up to date with
`origin/develop`.

## Step 1 — Release branch

```bash
git checkout -b release/x.y.z develop
```

## Step 2 — Version + changelog

- `package.json` -> `version` becomes `X.Y.Z`.
- `CHANGELOG.md` -> move the `[Unreleased]` entries into `## [X.Y.Z] - <YYYY-MM-DD>` above a
  fresh `## [Unreleased]`. Keep the keep-a-changelog sections (`Added` / `Changed` /
  `Deprecated` / `Removed` / `Fixed` / `Security`).

Commit both files:

```bash
git add package.json CHANGELOG.md
git commit -m "release: vX.Y.Z"
```

## Step 3 — Release PR (blocking gate)

```bash
git push -u origin release/x.y.z
devbox run gh pr create --base main --head release/x.y.z \
  --title "Release vX.Y.Z" --body "See CHANGELOG.md." \
  2>&1 | grep -v "devbox\|Welcome\|Node.js version\|npm version\|^$\|Running script\|v22\|10.9"
```

- **Add the `release` label** — the guard workflow rejects any PR to `main` without it.
- Long PR bodies must go through a file (`--body-file`), not an inline heredoc.
- Wait for `check` to pass, then merge:

```bash
devbox run gh pr merge <PR> --merge
```

## Step 4 — Tag and let CI do the rest

```bash
git checkout main && git pull
git tag -a vX.Y.Z -m "River King Engine vX.Y.Z"
git push origin vX.Y.Z
```

- `deploy.yml` redeploys GitHub Pages; `release.yml` drafts the GitHub Release with
  auto-generated notes.
- Publishing the draft release (or editing its notes) is a **human** action — say so, do
  not do it.

## Step 5 — Sync develop

```bash
git checkout develop && git pull
```

- Ensure `CHANGELOG.md` on `develop` carries the `## [X.Y.Z]` section too (the release PR
  only wrote it on `main`), above a fresh `## [Unreleased]`. Push directly or open a small
  PR to `develop`.
- Move the kanban card to **Done** with the `ticket-management` skill:

```bash
devbox run gh project item-edit 6 --owner xLeDocteurx --url "<ISSUE_URL>" \
  --field "Status" --value "Done" \
  2>&1 | grep -v "devbox\|Welcome\|Node.js version\|npm version\|^$\|Running script\|v22\|10.9"
```

## Common mistakes

- Missing `release` label -> the guard workflow rejects the PR to `main`.
- Tagging before the merge lands on `main` -> no Pages redeploy, no draft release.
- Forgetting the `develop` changelog port -> the next release PR conflicts on `CHANGELOG.md`.
- Skipping the prechecks -> a red release PR that cannot merge.
- Long `gh` bodies inline -> mangled; write the body to a file and use `--body-file`.
- Forgetting the `| grep -v ...` filter on `gh` -> unreadable devbox banner noise.

## Keeping this skill in sync

`docs/release-process.md` is the source of truth. When the process changes, update the
runbook first, then re-check the steps above.
