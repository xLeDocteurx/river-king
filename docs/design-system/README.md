# Design System Reference

River King Engine's visual identity is **"Pro Editor"** (VS Code / Aseprite spirit): dense,
crisp, sober. This folder is the normative reference for any UI work in this repository.

## What to read per task

| Task                         | Read                                                                      |
| ---------------------------- | ------------------------------------------------------------------------- |
| New component                | `foundations.md` → `components.md` → `checklist.md`                       |
| New screen / page            | `foundations.md` → `layout.md` → `interactions.md` → `checklist.md`       |
| Restyling an existing screen | `layout.md` → `components.md`, diffing current markup against the recipes |
| Choosing a color / text size | `foundations.md`                                                          |

## How the rules work

- Rules tagged **(new pattern)** define conventions agreed for upcoming work that is not yet
  implemented anywhere; apply them as soon as the situation arises.
- Everything else reflects shipped code. Reference implementations: topbar
  (`src/app/app.component.html`) and dashboard (`src/app/features/dashboard/`).
- If you change how something looks, update the relevant file here in the same commit.
- `checklist.md` is mandatory before delivering any UI work; AGENTS.md carries the condensed
  non-negotiables.
