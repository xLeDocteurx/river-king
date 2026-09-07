# Git workflow

This project uses a lightweight **develop model**.

## Branches

| Branch             | Role                                                                | Protected |
| ------------------ | ------------------------------------------------------------------- | --------- |
| `main`             | Stable line, reserved for future releases                           | Yes       |
| `develop`          | Integration base, **default branch** of the repository              | Yes       |
| `feature-<ticket>` | One per issue, created from `develop`, merged via PR into `develop` | No        |

Only `main` and `develop` are long-lived. Everything else is ephemeral and auto-deleted
once its PR merges.

## Rules

- **Default branch is `develop`.** New pull requests open with `develop` as their base.
- **Feature branches always branch from `develop`.** Never from `main`, and never stacked
  on another feature branch. If you need another feature's work, merge `develop` into yours
  once that PR has merged.
- **Pull requests target `develop`** and close their issue (`Closes #N`).
- **`main` only receives release PRs**, identified by the `release` label.
- Branch protection on both `main` and `develop`: pull requests are required, at least one
  approving review, status checks required, no direct pushes (admins included).

## Guard on PRs to `main`

GitHub cannot natively forbid a pull request from targeting a given branch. This repository
enforces the rule with `.github/workflows/guard-no-pr-to-main.yml`: any PR whose base is
`main` fails its check **unless** the PR carries the `release` label. Because `develop` is
the default branch, this workflow runs for every pull request regardless of base.

## Release flow (deferred)

Versioning is intentionally not set up yet. When it is decided:

1. `develop` holds the accumulated features, validated by tests + lint.
2. Create `release/<version>` from `develop`, bump the version (SemVer, synced in
   `package.json`).
3. Open the PR to `main` with the `release` label (the only allowed PR to `main`).
4. Merge, tag `v<version>`, publish a GitHub Release.
5. Merge `release/<version>` back into `develop` and delete it.

Until then, `main` stays as-is and no release PRs are expected.

## FAQ

- _Why not trunk-based?_ The stable `main` line is wanted for versioning, so all normal work
  flows through `develop` first.
- _What if a PR already targets another feature branch?_ It predates this document. Retarget
  it to `develop` as soon as the previous PR has merged.
- _Can I merge `main` into a feature branch?_ There is nothing on `main` that isn't on
  `develop`, so merge `develop` instead.
