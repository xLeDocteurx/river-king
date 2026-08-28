# Plan: Folder deletion in lists (issue #4)

Branch: `feature-4`

## Goal

Give empty folders a delete button in both lists (scene-list + tile-manager), confirmed via
`rk-confirm-dialog`. Non-empty folders cannot be deleted.

## Design decisions

- **Where the button lives:** `GroupedListComponent` (shared). It already renders group
  headers and knows `group.items.length`. Add a `groupDelete` output; render the delete
  button **only** when `group.key !== '' && group.items.length === 0`. Buttons act in
  `onGroupDelete(key, event)` with `stopPropagation` + `preventDefault` + `draggable="false"`
  so it never triggers the group-header drag (header row is `draggable="true"`).
- **Empty semantics:** a folder group is empty iff no item (scene/tile) has `folderPath === key`.
  "Non-empty" guard also blocks when descendant folders contain items (path prefix match),
  so deleting `forest` is blocked while `forest/caves` still holds items.
- **Scene folders (persisted):** `SceneService.deleteFolder(projectId, path)` removes the
  `db.folders` row(s) whose `path === path` OR `path.startsWith(path + '/')` (deletes empty
  descendants too).
- **Tile folders (derived, in-memory signal only):** deletion just removes the path (and
  empty descendants) from the `folders` signal. No DB change.
- **UI copy:** English. Warning `Folder "X" is not empty and cannot be deleted.` via
  `NotificationService.warning`.
- **Dialog:** a second `<rk-confirm-dialog>` per parent, opened programmatically (mirrors the
  existing scene-delete pattern: `pendingDelete*` signal + computed `ConfirmDialogData`).

## Tasks

- [ ] Create `feature-4` branch; kanban → In progress
- [ ] Write failing tests (wrappers: button visibility + `folderDelete` emit; parents:
      DB-backed delete flow + non-empty guard)
- [ ] `GroupedListComponent`: add `groupDelete` output, `onGroupDelete`, delete button in header
- [ ] `SceneListComponent` / `TileListTreeComponent`: passthrough `folderDelete` output
- [ ] `SceneService`: add `deleteFolder(projectId, path)`
- [ ] `SceneEditorComponent`: `pendingDeleteFolderPath`, dialog data, request handler +
      confirm handler (delete via service + `loadFolders()`)
- [ ] `TileManagerComponent`: `pendingDeleteFolderPath`, dialog data, request handler +
      confirm handler (drop path from `folders` signal)
- [ ] Wire new `(folderDelete)` binding + second `rk-confirm-dialog` in both parents' HTML
- [ ] Run `devbox run npm run lint` / `test` / `build`
- [ ] Commit per task (`feature-4: ...`); push; open PR `Closes #4`; kanban → In review

## Acceptance criteria (from issue #4)

- [ ] A folder that is empty has a delete button (visible per group header)
- [ ] Deletion is confirmed via `rk-confirm-dialog`
- [ ] A non-empty folder cannot be deleted (button hidden + guard + warning)