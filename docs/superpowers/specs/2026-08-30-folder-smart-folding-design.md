# Folder Smart Folding

Date: 2026-08-30
Status: Draft
Linked issue: #17

## Problem

Long folder lists make navigation slow in both the scene list and tile tree:
every folder is expanded by default and stays expanded during a session. When a
project grows to many top-level folders, the list becomes a wall of items and
finding a specific one requires scrolling.

## Solution

Introduce "smart folding": when a list has more top-level folders than a fixed
threshold (6), folders collapse by default. Folders the user recently interacted
with (opened / selected an item inside) stay expanded. Manual expand/collapse
overrides are respected and persisted so they survive a session. Flat projects
(no folders, or ≤ threshold folders) render exactly as today.

The behavior applies identically to the two folder-based lists: the scene list
(`SceneListComponent`) and the tile tree (`TileListTreeComponent`).

## Design decisions (finalized 2026-08-30)

1. **Scope** — Both lists: scenes and tiles.
2. **Threshold** — Fixed constant, top-level folders `> 6` triggers default folding.
3. **Persistence** — Extended unified `Folder` model persisted in IndexedDB
   (`folders` table). Survives sessions.
4. **Recents** — Track `lastOpenedAt` per folder; folders above the threshold stay
   expanded when recently interacted with.
5. **No behavior change** for flat projects / ≤ threshold: all folders expanded.

## Architecture

### Data model changes (schema v6)

The `Folder` model is extended to serve both scene folders (already rows) and
tile folders (currently derived from `Tile.folderPath`, not rows). Two new optional
fields are added, and a discriminator field distinguishes the folder kind so a
scene folder and a tile folder sharing the same `path` do not collide.

```ts
export type FolderKind = 'scene' | 'tile';

export interface Folder {
  id: string;             // UUID (existing)
  projectId: string;      // existing
  path: string;           // existing (e.g. "forest/caves")
  kind: FolderKind;       // NEW — which list this folder row belongs to
  collapsed: boolean;     // NEW — manual override; false = expanded
  lastOpenedAt: number;   // NEW — epoch ms of last interaction, 0 if never
}
```

- Existing scene-folder rows are migrated with `kind = 'scene'`,
  `collapsed = false`, `lastOpenedAt = 0`.
- Tile folders are **materialized on demand**: the first time the tile list needs
  to persist state for a derived folder path, it upserts a `kind = 'tile'` row.
  Deriving and folding still relies on the real set of paths (from `distinct
  Tile.folderPath`) plus any materialized rows (to keep empty-but-expanded /
  collapsed folders visible via `GroupedListComponent.groupKeys`).
- `lastOpenedAt` is bumped whenever the user selects a scene/tile inside that
  folder, or manually expands it.
- `collapsed` is a manual override: once set by the user it is respected over the
  threshold default. A user collapsing a folder writes `collapsed = true`; a user
  expanding writes `collapsed = false`. Clearing an override (returning to
  threshold-based behavior) unsets the row when no user intent remains — on first
  implementation, keep it simple: any manual toggle sets the flag explicitly.

Schema v6 migration (Dexie upgrade):

```ts
this.version(6).stores({
  folders: 'id, projectId, path, kind',
}).upgrade(async (tx) => {
  await tx.table('folders').toCollection().modify((f: Folder) => {
    f.kind = 'scene';
    f.collapsed = false;
    f.lastOpenedAt = 0;
  });
});
```

`folders` becomes indexed by `projectId, path, kind`. The composite identity of a
folder row is `(projectId, kind, path)`.

### Shared folding logic

A new service `features/<editor>/services/folder-state.service.ts` (one per
feature shell, or a shared helper in `shared/`) provides the "which folders are
collapsed" computation shared by both lists:

```ts
// pseudo-signature
folderState(projectId, kind, paths): Promise<Map<string, boolean>>
```

The rule (given the threshold `T = 6`):

```
for each top-level folder key:
  if row has explicit collapsed  -> use it
  else if topLevelCount > T and row.lastOpenedAt is old (not "recent")
       -> collapse by default
  else -> expanded
```

"Recently interacted" is defined as a fixed recency window (e.g. `lastOpenedAt`
within the current session window, or simply `lastOpenedAt > 0` on first
implementation). The spec keeps a simple first cut: a folder above the threshold
stays expanded if the user opened it this session (a `lastOpenedAt` bumped during
the current session). A follow-up can widen this.

### Component wiring

- `SceneListComponent` currently owns a local non-persisted `collapsedFolders`
  signal and passes it nowhere; `GroupedListComponent` receives `collapsedGroups`
  as an input and emits `toggleGroup`. The scene shell will load folder state and
  pass the computed collapsed set as an input, persisting changes on `toggleGroup`.
- `TileListTreeComponent` receives `collapsedFolders` as an input from
  `TileManagerComponent` (a local signal). The tile shell loads folder state the
  same way, persists on toggle, and ensures tile folder rows exist by upserting
  on first interaction.
- `GroupedListComponent` is unchanged: it already consumes `collapsedGroups` and
  emits `toggleGroup`. Only the ownership of the state moves up to a persisted
  source.

## UI/UX details

- No new visual treatment: only the default-open/closed state changes based on
  threshold, plus persisted manual overrides.
- Folders recently opened stay expanded; everything else collapses above the
  threshold.
- The folder disclosure chevron behavior is unchanged.
- Flat projects and projects with ≤ 6 top-level folders are visually identical to
  today.

## Data model changes

Covered in the Data model changes section above (Folder fields + schema v6).

## Testing

- **Service tests** (`folder-state.service.spec.ts`): fold logic given threshold,
  explicit overrides win; recency keeps recent folders open; flat list unchanged.
- **Migration test**: upgrading existing scene-folder rows sets `kind='scene'`,
  `collapsed=false`, `lastOpenedAt=0`.
- **Component tests**: `SceneListComponent` / `TileListTreeComponent` receive a
  collapsed set and render groups collapsed/expanded; `toggleGroup` persists.
- **Tile materialization test**: a derived tile folder path, once interacted with,
  results in a persisted `kind='tile'` row.

## Performance considerations

- Folder state is per-project and small (dozens of entries); a single query per
  list load is negligible.
- Computed `collapsed` set is memoized in a signal and only recomputed when the
  underlying folders/items change.
- Only materialize tile-folder rows lazily to avoid writing a row for every
  derived path up front.

## Out of scope

- No user-facing setting for the threshold (fixed constant for now).
- No collapsible panel memory for the editor side panels themselves (that is
  #23 responsive / layout, not #17).
- No tree virtualization for very large item lists.
- No persisted "recency" ranking algorithm beyond a simple `lastOpenedAt` window.
