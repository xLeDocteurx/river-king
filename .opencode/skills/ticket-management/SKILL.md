---
name: ticket-management
description: Use when capturing new feature ideas or bugs, triaging them into GitHub Issues, updating a GitHub Project kanban (add cards, change Status/Priority/Size), or giving corrections/feedback on a previous user story/issue. Relevant whenever docs/ideas.md, gh project, issue creation/status transitions, or revisiting a shipped/in-progress US come up during a session.
---

# Ticket Management

Manage the idea → issue → kanban pipeline for the River King engine.

## The 3-layer model

| Layer | Where | Purpose |
|-------|-------|---------|
| **INBOX** | `docs/ideas.md` | Raw, uncommitted ideas. Verbatim capture, no promises. Every new idea starts here. |
| **BACKLOG** | GitHub Issues + kanban (#6) | Committed topics with status/lifecycle and discussion. One issue per idea. |
| **DETAIL** | `docs/superpowers/specs/` + `plans/` | The precise what/how once an idea is Groomed and Ready. Linked to the issue. |

## Workflow

```
oral idea → append to docs/ideas.md → clarify → create GitHub issue
→ add kanban card (Status: Backlog) → groom (Backlog→Ready, set Priority/Size)
→ brainstorm + write spec (linked to issue in issue body) → plan → implement
→ PR with "Closes #<issue>" → On merge: Status: Done
```

## Do in every capture

1. **Ask** 2-3 clarifying questions about the idea (what, who, where).
2. **Append** a bullet to `docs/ideas.md` under the matching impact section (or create one).
3. Only after the user confirms a topic is worth committing: create the GitHub issue and kanban card.

## GitHub Issue creation

Use `gh` through devbox. All commands must be filtered to strip devbox noise:

```bash
devbox run gh issue create --title "<Title>" --body "<Body>" 2>&1 | grep -v "devbox\|Welcome\|Node.js version\|npm version\|^$\|Running script\|v22\|10.9"
```

**Issue body template** (from `docs/superpowers/specs/` origin or idea elaboration):

```markdown
## Context
<!-- why this matters, what user flow it enables -->

## Proposed behavior
<!-- what should happen -->

## Acceptance criteria
- [ ]
- [ ]
```

**Labels** (all exist on the repo; create with `devbox run gh label create <name> --color <hex>` if one is missing):
`idea`, `enhancement`, `bug`, `spec`, `chore`, `documentation`.

Assign labels that match: `bug` for defects, `enhancement` for feature requests.

## Kanban card management

Project #6 = "@xLeDocteurx's River King Kanban" (owner `xLeDocteurx`).

The Status field uses by-name option values (robust, no GraphQL IDs needed).

**Add issue to kanban (move from issue to card):**

```bash
devbox run gh project item-add 6 --owner xLeDocteurx --url "<ISSUE_URL>" \
  2>&1 | grep -v "devbox\|Welcome\|Node.js version\|npm version\|^$\|Running script\|v22\|10.9"
```

**Set Status (grooming / progress transitions):**

```bash
devbox run gh project item-edit 6 --owner xLeDocteurx --url "<ISSUE_URL>" \
  --field "Status" --value "Ready" \
  2>&1 | grep -v "devbox\|Welcome\|Node.js version\|npm version\|^$\|Running script\|v22\|10.9"
```

**Set Priority / Size (grooming time):**

```bash
devbox run gh project item-edit 6 --owner xLeDocteurx --url "<ISSUE_URL>" \
  --field "Priority" --value "P1" \
  2>&1 | grep -v "devbox\|Welcome\|Node.js version\|npm version\|^$\|Running script\|v22\|10.9"
```

**Valid values (field-list confirmed):**
- `Priority`: `P0`, `P1`, `P2`
- `Size`: `XS`, `S`, `M`, `L`, `XL`
- `Status`: `Backlog`, `Ready`, `In progress`, `In review`, `Done`

Verify current options anytime with
`devbox run gh project field-list 6 --owner xLeDocteurx` (filtered the same way).

**Constraints of `gh project item-edit`:**
- Non-draft issues: **one field per invocation** only.
- By-name `--field "Status" --value "Backlog"` syntax is preferred over GraphQL IDs.
- Use `--owner xLeDocteurx` explicitly.

## Grooming

When moving an idea from Backlog to Ready, also set Priority and Size, and link the
design spec once it exists: append `Spec: docs/superpowers/specs/<file>.md` to the issue body.

## Corrections / feedback on an existing US

All feedback lives **on the issue itself** (source of truth), not in chat — it evaporates.

**1. Clarification / minor tweak (no scope change):**
→ Comment on the issue. If the change is recurring, amend the acceptance criteria in the issue body.

**2. Spec changes (US in progress, the what/how shifts):**
→ Update the issue body **and** `docs/superpowers/specs/<file>.md` if one exists (note the change in an issue comment). If work is already in review, move the card back:

```bash
devbox run gh project item-edit 6 --owner xLeDocteurx --url "<ISSUE_URL>" \
  --field "Status" --value "In progress" \
  2>&1 | grep -v "devbox\|Welcome\|Node.js version\|npm version\|^$\|Running script\|v22\|10.9"
```

**3. Feedback reveals new scope:**
→ New issue (1 US = 1 issue), cross-link both bodies with `Related to #N`. If the new subject is still an idea, capture it to `docs/ideas.md` first.

Rule of thumb: **feedback = comment first, then either amend the US or split a new US depending on its weight.** The kanban is only touched when the work state must reflect the change.

## Common mistakes

- Forgetting the `| grep -v ...` noise filter → output unreadable.
- Using GraphQL IDs for Status → brittle, breaks when fields change.
- Creating an issue before the user confirmed the idea is worth committing → always ask first.
- Not linking the spec to the issue → the kanban card loses its details.
- Giving feedback only in chat → it evaporates; always capture it as an issue comment.

## Interacting with the user

- Keep status transitions visible: report when a card moves (Backlog → Ready, …).
- When the user suggests a new idea, capture it to `docs/ideas.md` first and confirm
  before opening an issue — the two steps are never bundled implicitly.