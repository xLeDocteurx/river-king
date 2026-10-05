# Release Process

Every stable line (`main`) deploy happens through this procedure. It is the source of truth
for both humans and agents: the `.opencode/skills/release` skill runs the identical steps,
and the CI workflows react to the artifacts this procedure produces.

## Conventions

| Element        | Value                                                           |
| -------------- | --------------------------------------------------------------- |
| Version        | SemVer `vX.Y.Z`, source of truth = `package.json`               |
| Release branch | `release/<x.y.z>`, always created from `develop`                |
| Release PR     | `release/<x.y.z>` → `main`, with the `release` label            |
| Tag            | Annotated `vX.Y.Z` on `main`, pushed after merge                |
| Changelog      | `CHANGELOG.md` (keep-a-changelog)                               |
| Deployment     | GitHub Pages, triggered by the merge into `main` (`deploy.yml`) |

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

The Pages site is already live at this point: the **merge of the release PR into `main`** is
what deploys it (Step 3). Pushing the tag does **not** redeploy.

```bash
git checkout main && git pull
git tag -a vX.Y.Z -m "River King Engine vX.Y.Z"
git push origin vX.Y.Z
```

- `.github/workflows/deploy.yml` runs **only** on pushes to `main` (and on manual dispatch).
  It must stay that way: the `github-pages` environment declares a custom deployment branch
  policy restricted to the `main` **branch**, so any deployment triggered from a **tag** is
  rejected with _"is not allowed to deploy to github-pages due to environment protection
  rules"_. Never re-add `tags: ['v*']` to that workflow.
- `.github/workflows/release.yml` drafts the GitHub Release at the tag with auto-generated
  notes; publish or tweak the notes in the UI.
- GitHub auto-deletes `release/<x.y.z>` once the PR merges.

## Step 5 — Give `develop` the new baseline

```bash
git checkout develop && git pull
```

- In `CHANGELOG.md`, ensure `[X.Y.Z]` is present on `develop` too (the release PR wrote it on
  `main`; port the same `[X.Y.Z]` section here so the next release branches don't conflict),
  and start a fresh `[Unreleased]` section above it. Bump `package.json` to `X.Y.Z` on the same
  commit, so `develop` reports the last published version. Commit and push (or open a tiny PR to
  `develop` for the version/changelog sync).
- Update the kanban: the release card (if any) moves to Done via the `ticket-management`
  skill.

## One-time setup (already done once)

1. GitHub → Settings → Pages → **Build and deployment** → Source: **GitHub Actions** (the
   deploy workflow, not a branch). This stays configured once and never needs revisiting.
