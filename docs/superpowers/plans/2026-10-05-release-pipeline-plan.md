# Release Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship issue #73: CI/CD automation for releases — GitHub Pages deploys from the Actions workflow on `main` pushes and `v*` tags, Release drafts per tag, plus the changelog scaffold and the release runbook.

**Architecture:** Extend the existing Pages deploy workflow (add tag triggers, rename to `deploy.yml`), add a tag-triggered Release-draft workflow, scaffold `CHANGELOG.md` (keep-a-changelog), and document the end-to-end procedure in a runbook. No app code changes.

**Tech Stack:** GitHub Actions (YAML), Angular production build, keep-a-changelog, SemVer.

## Global Constraints

- Branch `feature-73` from `develop`; every commit prefixed `feature-73:`.
- Docs/UI copy in English only (GitHub-facing content).
- Deployment = GitHub Pages with source **GitHub Actions** (`actions/deploy-pages`); the existing `actions/upload-pages-artifact` + `actions/deploy-pages` pattern stays.
- Build uses production config with `--base-href /river-king/`, plus the SPA 404 fallback (copy `index.html` → `404.html`).
- Node 22 (matches `devbox.json` pin) on `ubuntu-latest`; npm cache enabled.
- The `release` label is what lets a PR through the guard workflow to `main`.
- Prettier must pass (`npm run format:check` runs in CI) — format every new/renamed doc and YAML.
- Conventions (from spec 2026-10-05): version `vX.Y.Z` from `package.json`; release branch `release/<x.y.z>`; PR to `main` with `release` label; annotated tag `vX.Y.Z`; changelog keep-a-changelog.

---

### Task 1: Deploy workflow (renamed + tag trigger)

**Files:**

- Rename: `.github/workflows/deploy-pages.yml` → `.github/workflows/deploy.yml`
- Modify: `.github/workflows/deploy.yml` (add `tags: ['v*']` to the push trigger)
- Verify: `.github/workflows/deploy.yml`

**Interfaces:**

- Consumes: the existing build/deploy pattern (`ng build --configuration production --base-href /river-king/`, `cp index.html 404.html`, `upload-pages-artifact@v3`, `deploy-pages@v4`).
- Produces: a workflow that runs on push to `main` **and** on tag pushes `v*`; the single deploy vehicle for GitHub Pages.

- [ ] **Step 1: Check the `yaml` parser is locally available (validates the workflow)**

Run: `node -e "require('yaml'); console.log('yaml OK')"` from the repo root.
Expected: `yaml OK`. If it throws, skip local parsing (step 2 substitutes) — GitHub validates workflow YAML on push; note this in the task review.

- [ ] **Step 2: Rename and extend the deploy workflow**

```bash
git mv .github/workflows/deploy-pages.yml .github/workflows/deploy.yml
```

Now edit `.github/workflows/deploy.yml` so the `on:` block reads exactly:

```yaml
on:
  push:
    branches: [main]
    tags: ['v*']
  workflow_dispatch:
```

Everything below `workflow_dispatch:` stays as-is (`permissions`, `concurrency`, `build`, `deploy` jobs with the base-href build, 404 fallback, and Pages artifact deployment). The final file must be (only the trigger changed vs before):

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
    tags: ['v*']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Build (base href /river-king/)
        run: npx ng build --configuration production --base-href /river-king/

      - name: SPA fallback (404.html)
        run: cp dist/river-king/browser/index.html dist/river-king/browser/404.html

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/river-king/browser

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Validate the workflow parses**

Run:

```bash
node -e "const fs=require('fs');const y=require('yaml');const d=y.parse(fs.readFileSync('.github/workflows/deploy.yml','utf8'));console.log('deploy.yml trigger keys:', Object.keys(d.on.push).join(','))"
```

Expected (when `yaml` resolves): `deploy.yml trigger keys: branches,tags`.

- [ ] **Step 4: Format**

Run: `devbox run npx prettier --write .github/workflows/deploy.yml`
Expected: no diff (already clean); any rewrap is committed with the file.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feature-73: deploy pages on main and v* tags (renamed deploy.yml)"
```

---

### Task 2: Release-draft workflow

**Files:**

- Create: `.github/workflows/release.yml`
- Verify: `.github/workflows/release.yml`

**Interfaces:**

- Consumes: annotated tag `vX.Y.Z` pushed to `main`.
- Produces: a **draft** GitHub Release at the tag, with notes auto-generated from merged PRs since the previous tag. Compatible with the human/agent flow: the same tag push triggers `deploy.yml` too.

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/release.yml` with exactly:

```yaml
name: Draft Release

on:
  push:
    tags: ['v*']

permissions:
  contents: write

jobs:
  draft:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Draft GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_notes: true
          draft: true
```

- [ ] **Step 2: Validate the workflow parses**

Run:

```bash
node -e "const fs=require('fs');const y=require('yaml');const d=y.parse(fs.readFileSync('.github/workflows/release.yml','utf8'));console.log('release.yml trigger keys:', Object.keys(d.on.push).join(','))"
```

Expected (when `yaml` resolves): `release.yml trigger keys: tags`.

- [ ] **Step 3: Format**

Run: `devbox run npx prettier --write .github/workflows/release.yml`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml && git commit -m "feature-73: draft a GitHub release on each v* tag"
```

---

### Task 3: Changelog scaffold + release runbook

**Files:**

- Create: `CHANGELOG.md`
- Create: `docs/release-process.md`

**Interfaces:**

- Consumes: spec 2026-10-05 conventions (version source = `package.json`, `release/<x.y.z>` branch, `release` label, `vX.Y.Z` annotated tag, keep-a-changelog).
- Produces: the human-facing runbook that the `release` skill (issue #75) and the CI workflows both mirror; `CHANGELOG.md` is the release-PR artifact.

- [ ] **Step 1: Create `CHANGELOG.md`**

Create `CHANGELOG.md` at the repo root with exactly:

```markdown
# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- First-run demo project seed: a « Demo » project with animated water, y-sort trees, a
  blocking boulder, and an interactable sign (#70).
- Release pipeline: GitHub Pages now deploys from the Actions workflow on `main` pushes and
  `v*` tags; a draft GitHub Release is created per tag (#73).
- Status bar shows the engine version (`River King Engine — vX.Y.Z`) from `package.json`
  (#74).
- Agent-driven release procedure through the `release` skill (#75).
```

- [ ] **Step 2: Create `docs/release-process.md`**

Create `docs/release-process.md` with exactly:

````markdown
# Release Process

Every stable line (`main`) deploy happens through this procedure. It is the source of truth
for both humans and agents: the `.opencode/skills/release` skill runs the identical steps,
and the CI workflows react to the artifacts this procedure produces.

## Conventions

| Element        | Value                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| Version        | SemVer `vX.Y.Z`, source of truth = `package.json`                      |
| Release branch | `release/<x.y.z>`, always created from `develop`                       |
| Release PR     | `release/<x.y.z>` → `main`, with the `release` label                   |
| Tag            | Annotated `vX.Y.Z` on `main`, pushed after merge                       |
| Changelog      | `CHANGELOG.md` (keep-a-changelog)                                      |
| Deployment     | GitHub Pages, source _GitHub Actions_ (`.github/workflows/deploy.yml`) |

## Step 0 — Prechecks

- `devbox run npm run test`, `devbox run npm run lint`, `devbox run npm run build` are all
  green locally.
- `develop` is green on CI (the `check` workflow is a required status).
- Working directory is clean and `develop` is up to date with `origin/develop`.

## Step 1 — Create the release branch

```bash
git checkout -b release/<x.y.z> develop
```

(The branch name matches the version being published, e.g. `release/0.1.0`; drop the `v`
prefix on the branch.)

## Step 2 — Bump version and changelog

- Edit `package.json` → move `version` to `X.Y.Z`.
- In `CHANGELOG.md`, move the shipped entries from `[Unreleased]` into a new
  `## [X.Y.Z] - <YYYY-MM-DD>` section at the top of the file (keep-a-changelog format:
  `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security`).
- Commit both.

## Step 3 — Open the release PR

```bash
git push -u origin release/<x.y.z>
```

- Open a PR `release/<x.y.z>` → `main`.
- Add the **`release`** label — required, the guard workflow rejects any PR to `main`
  without it.
- Wait for CI (`check`) to pass, then merge the PR.

## Step 4 — Tag and let CI do the rest

```bash
git checkout main && git pull
git tag -a vX.Y.Z -m "River King Engine vX.Y.Z"
git push origin vX.Y.Z
```

- `.github/workflows/deploy.yml` redeploys the Pages site (it already deployed on the `main`
  merge; the tag push re-runs it).
- `.github/workflows/release.yml` drafts the GitHub Release at the tag with auto-generated
  notes; publish or tweak the notes in the UI.
- GitHub auto-deletes `release/<x.y.z>` once the PR merges.

## Step 5 — Give `develop` the new baseline

```bash
git checkout develop && git pull
```

- In `CHANGELOG.md`, ensure `[X.Y.Z]` is present on `develop` too (the release PR wrote it on
  `main`; port the same `[X.Y.Z]` section here so the next release branches don't conflict),
  and start a fresh `[Unreleased]` section above it. Commit and push (or open a tiny PR to
  `develop` for the changelog sync).
- Update the kanban: the release card (if any) moves to Done via the `ticket-management`
  skill.

## One-time setup (already done once)

1. GitHub → Settings → Pages → **Build and deployment** → Source: **GitHub Actions** (the
   deploy workflow, not a branch). This stays configured once and never needs revisiting.
````

- [ ] **Step 3: Format both docs**

Run: `devbox run npx prettier --write CHANGELOG.md docs/release-process.md`
Expected: no semantic change (passes `format:check`).

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md docs/release-process.md && git commit -m "feature-73: add keep-a-changelog scaffold and release runbook"
```

---

### Task 4: Final verification

- [ ] **Step 1: Full suite + lint + format + build**

Run: `devbox run npm run test` → all green.
Run: `devbox run npm run lint` → `All files pass linting.`
Run: `devbox run npm run format` then `devbox run npm run format:check` → `All matched files use Prettier code style!` (commit any stragglers).
Run: `devbox run npm run build` → completes within budgets.

- [ ] **Step 2: Confirm the branch shape**

Run: `git log --oneline develop..HEAD`
Expected: three `feature-73:` commits (deploy rename + tag trigger, release draft workflow, changelog + runbook) — no merged-spec commit (spec is already on `develop`).

- [ ] **Step 3: Commit any formatting stragglers**

```bash
git add -A && git commit -m "feature-73: apply prettier formatting"   # only if format changed anything
```

## Notes

- `deploy-pages.yml` is intentionally renamed: the name `deploy.yml` is referenced by the
  spec, the runbook, and the `release` skill. GitHub tracks workflow runs by file path, so
  the rename simply starts a new run history.
- The Pages deploy requires the repo's Pages **source** to be _GitHub Actions_ (a repository
  settings toggle, not a code change) — the runbook documents it as an already-done
  one-time step. It is NOT part of this plan's code, but shipping this plan calls the manual
  switch: do it on the repo settings when this plan merges.
