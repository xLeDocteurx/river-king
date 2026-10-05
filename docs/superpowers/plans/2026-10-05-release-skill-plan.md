# Release Skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `.opencode/skills/release/SKILL.md`, an agent-driven skill that cuts a release following `docs/release-process.md` exactly.

**Architecture:** One self-contained `SKILL.md` with valid frontmatter (`name`, `description`), mirroring the structure and voice of the existing `ticket-management` skill: conventions pointer, numbered steps with executable commands, blocking preconditions, common mistakes. It references the runbook instead of duplicating the conventions table so there is one source of truth.

**Tech Stack:** Markdown (agent skills, no code). Verification = frontmatter parse + prettier + repo lint/test gate.

## Global Constraints

- Branch `feature-75`, commit prefix `feature-75:`, PR into `develop` with `Closes #75`.
- `docs/release-process.md` is the source of truth for the process; the skill must point at it, not restate the conventions (spec decision 2).
- Only `SKILL.md` is committed under `.opencode/skills/release/` — `.opencode/.gitignore` ignores `node_modules`, `package.json`, `package-lock.json`, `bun.lock`.
- Frontmatter must have exactly `name` and `description` keys; `name` = `release`, matching the directory name.
- Every `gh` command runs through `devbox run` and is filtered to strip the devbox banner noise (repo convention, see `ticket-management`).
- English only (GitHub-facing / repo-facing content).
- All commands in the skill must match the runbook verbatim where they overlap.

---

### Task 1: Author the release skill

**Files:**

- Create: `.opencode/skills/release/SKILL.md`
- Read (no change expected): `docs/release-process.md`

**Interfaces:**

- Consumes: the six runbook steps from `docs/release-process.md`; the `ticket-management` skill for the kanban transition; the noise filter pattern from `.opencode/skills/ticket-management/SKILL.md`.
- Produces: a skill named `release`, triggered on release intent.

- [ ] **Step 1: Write the failing verification**

There is no unit test for prose, so the verification is a frontmatter check that fails before the file exists:

```bash
python3 - <<'PY'
import re, pathlib
p = pathlib.Path('.opencode/skills/release/SKILL.md')
assert p.exists(), 'SKILL.md missing'
text = p.read_text()
m = re.match(r'^---\n(.*?)\n---\n', text, re.S)
assert m, 'missing frontmatter block'
fm = dict(re.findall(r'^(name|description):\s*(.+)$', m.group(1), re.M))
assert fm.get('name') == 'release', fm.get('name')
assert len(fm.get('description', '')) > 40, 'description too short'
print('frontmatter OK')
PY
```

Run it: expected FAIL with `SKILL.md missing`.

- [ ] **Step 2: Create the skill**

Create `.opencode/skills/release/SKILL.md`:

````markdown
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
````

- [ ] **Step 3: Verify the frontmatter check passes**

Run the Step 1 python snippet again: expected `frontmatter OK`.

- [ ] **Step 4: Confirm the runbook already advertises the skill**

`docs/release-process.md` opens with "the `.opencode/skills/release` skill runs the identical
steps". No edit needed; if that sentence is absent, add it.

- [ ] **Step 5: Format and verify the repo gate**

Run: `devbox run npm run format` then `devbox run npm run format:check` -> `All matched files use Prettier code style!`
Run: `devbox run npm run lint` -> `All files pass linting.`
Run: `devbox run npm run test` -> all green.

- [ ] **Step 6: Commit**

```bash
git add .opencode/skills/release/SKILL.md
git commit -m "feature-75: add the agent-driven release skill"
```

## Notes for the implementer

- Keep `SKILL.md` focused: it is a command sequence, not an essay.
- Do not add a `scripts/` folder — the release needs judgment, not automation (spec decision 1).
- `.opencode/.gitignore` ignores `package.json` under skills, so nothing but `SKILL.md` should appear in `git status`.
