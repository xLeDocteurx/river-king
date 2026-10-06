# Release Skill — Design

**Issue:** #75 — Release skill: agent-driven release process (.opencode/skills/release)
**Date:** 2026-10-05
**Status:** Approved (deliverable #75 of `2026-10-05-release-process-design.md`)

## Context

`docs/release-process.md` (shipped in #73) is the human-facing runbook for cutting a
release. Its steps are exactly the kind of multi-step, tool-driven sequence an agent should
follow reliably: branch, bump, changelog, PR, merge, tag, sync back. An agent currently has
to re-derive the sequence from prose each time and can drift from the conventions table.

## Proposed behavior

A `.opencode/skills/release/SKILL.md` skill that walks an agent through a release end to
end, executing the same commands as the runbook.

## Acceptance criteria

- [ ] `.opencode/skills/release/SKILL.md` exists with valid frontmatter (`name`, `description`)
- [ ] Steps match `docs/release-process.md` exactly (no second source of truth that can drift)
- [ ] Cross-references the `ticket-management` skill for the kanban transition
- [ ] Documents the `release` label requirement and the `check` CI gate

## Design decisions

1. **Skill, not script.** The steps need judgment (version choice, changelog wording,
   reading CI output), so the skill is prose + commands an agent follows, not a bash script.
   A script could not decide what goes in the release notes.
2. **The runbook stays the source of truth.** `SKILL.md` must not restate the process in a
   divergent way: it carries the executable command sequence plus explicit pointers
   ("conventions table: `docs/release-process.md`"), and both cross-link each other. When the
   process changes, the runbook is edited first, then the skill's pointers are checked.
3. **Scope = one release.** The skill takes the target version as input (`vX.Y.Z`) and runs
   the six steps (prechecks, branch, bump, PR+merge, tag, sync-back). It does not decide
   _whether_ to release, does not create the changelog content for unreleased work, and does
   not publish the drafted GitHub Release (the runbook leaves that as a human action).
4. **Fail fast on the gates.** Prechecks (tests, lint, build, green `develop` CI) and the
   `release`-label requirement are stated as blocking preconditions, because both failure
   modes are silent otherwise: the guard workflow rejects an unlabelled PR, and the Pages
   deploy is triggered by the merge into `main` — a tag-triggered deploy is rejected by the
   `github-pages` environment's branch policy _(amended 2026-10-06: the original wording,
   "the Pages deploy only re-runs correctly when the tag lands on `main`", described a
   behaviour that never existed)_.
5. **Frontmatter description** triggers on release intent ("cut a release", "publish a
   version", "tag a release"), matching the `ticket-management` style: third-person, states
   _when_ to use it.
6. **Out of scope:** changelog authoring for unreleased work, release notes editing,
   hotfix flows off a released tag (a separate issue if it ever comes up), versioning policy
   changes (manual semver stays).

## Risks & mitigations

- _Drift between skill and runbook_: mitigated by decision 2 — pointers, not duplication.
- _Skill diverging into "just merge things":_ mitigated by decision 4's blocking
  preconditions.
