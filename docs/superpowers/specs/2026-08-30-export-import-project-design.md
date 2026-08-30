# Export / Import Project

Date: 2026-08-30
Status: Draft
Linked issue: #2

## Problem

A project can only be saved internally (IndexedDB, `RiverKingDB`). There is no way to
recover it outside the browser, back it up, or share it. The only path today is manual
recreation, which loses scenes, tiles and sprites.

The app stores all data in Dexie over IndexedDB (`core/services/database.service.ts`,
schema v5). There is **no existing** serialization, download, file-read, or import code
anywhere in `src/` (verified greenfield).

## Solution

Add project **Export** and **Import** to the dashboard. Export serializes a whole project
into a single downloadable JSON file with images embedded as base64. Import restores it,
letting the user choose to create a **new project** or **overwrite an existing one**.
Because all image data is already stored as base64 PNG data URLs, no re-encoding is needed.

## Design decisions (finalized 2026-08-30)

1. **Single JSON file, images embedded.** One file, e.g. `river-king-<slug>.json`. The
   project's sprites carry `pixelData: string` (a `data:image/png;base64,...` URL) and
   optional `paletteIndices: number[][]`. Both are already JSON-safe strings/nested arrays,
   so the whole payload round-trips with `JSON.stringify`/`JSON.parse` and re-inserts into
   IndexedDB with zero re-encoding.

2. **Whole-project scope.** Export captures everything owned by the project: the `Project`
   row, all `Folder` rows (scene folders), all `Scene` rows (with full `layers[]` +
   `tileData`), all `Tile` rows (with `spriteIds`, `properties`, `folderPath`), all `Sprite`
   rows (`pixelData`, `paletteIndices`), and the per-project `Session` UI state. The app's
   global theme (`localStorage` `rk-theme`) is not project data and is excluded.

3. **Import default = new project; overwrite is opt-in.** At import the user chooses:
   - **Create new project** (recommended, safest): the imported data becomes a fresh
     project with new `Project.id`, and numeric `Tile`/`Sprite` ids are remapped so nothing
     collides with existing rows.
   - **Overwrite existing project**: the rebuilt dataset replaces a selected project.
     Requires explicit confirmation through `rk-confirm-dialog`.

4. **Import always remaps numeric ids via old→new maps.** `Tile.id`/`Sprite.id` are
   auto-increment numbers and will collide when importing into a non-empty DB. The importer
   builds `tileMap: Map<oldId, newId>` and `spriteMap: Map<oldId, newId>` and rewrites every
   cross-reference before/while inserting:
   - `Layer.tileData` cells → `tileMap`
   - `Tile.spriteIds` → `spriteMap`
   - `Sprite.tileId` → `tileMap`
   - `Scene.projectId`, `Tile.projectId`, `Sprite.projectId`, `Folder.projectId`,
     `Session.projectId` → the (new or target) `Project.id`

## Format (proposed envelope)

```jsonc
{
  "format": "river-king-project",
  "version": 1,
  "app": "River King Engine",
  "exportedAt": 1750000000000,
  "project": {
    "name": "My Game", "palette": ["#000000", ...],
    "tileSize": 16, "mapWidth": 40, "mapHeight": 30,
    "createdAt": 0, "updatedAt": 1749999999999
  },
  "folders": [{ "id": "...", "path": "forest/caves" }],
  "scenes": [{ "id": "...", "projectId": "<remapped>", "name": "...",
    "folderPath": "", "width": 40, "height": 30,
    "layers": [{ "id": "...", "name": "Background", "visible": true,
      "opacity": 1, "tileData": [[-1, -1, ...]] }] }],
  "tiles": [{ "id": 1, "projectId": "<remapped>", "name": "Grass",
    "type": "static", "spriteIds": [1, 2], "animationSpeed": 8,
    "properties": { "blocking": false, "interactable": false },
    "folderPath": "" }],
  "sprites": [{ "id": 1, "projectId": "<remapped>", "tileId": 1,
    "name": "Grass", "width": 16, "height": 16,
    "pixelData": "data:image/png;base64,...",
    "paletteIndices": [[0, -1, ...]] }],
  "session": { "projectId": "<remapped>", "lastScreen": "scenes",
    "lastSceneId": "...", "lastTileId": 1, "lastSpriteId": 1 }
}
```

Notes:

- The export **excludes** the original `Project.id` / `Scene.id` / `Folder.id` identity on
  purpose — import always generates fresh UUIDs for string-keyed rows, and numeric-keyed
  rows get remapped. `id` fields are shown above only to document which fields the importer
  consumes for reference rewriting (the original values inside the file are informational
  and superseded).
- `paletteIndices` is preserved (index-stable) only when the imported `palette` array is
  kept in the exact same order. Since import keeps `project.palette` verbatim, indices stay
  valid. As a safety net the importer may recompute `paletteIndices` from `pixelData` via
  `decodePixelData` if a palette mismatch is ever detected — but with verbatim palettes this
  is not expected.
- Footprints are **not** serialized: they are derived at render time
  (`MapTilesService.loadTileVisuals`) from the first sprite's `width`/`height` ÷
  `project.tileSize`, so they reconstruct automatically.

## Architecture

### New: `core/services/project-export.service.ts` (root-provided singleton)

Owns both directions. Public API:

- `exportProject(project: Project): Promise<void>` — loads all child rows via the existing
  services/table access, assembles the envelope, triggers a browser download, and reports
  via `NotificationService`.
- `importProject(file: File, mode: 'new' | 'replace', targetProjectId?: string): Promise<void>`
  — parses + validates the JSON, then either creates a new project or replaces an existing
  one, remapping ids throughout. Reports success/failure via `NotificationService`.

Implementation notes:

- **Download:** build `new Blob([json], { type: 'application/json' })` and trigger a
  programmatic `<a download="river-king-<slug>.json">` click with
  `URL.createObjectURL(blob)`; revoke the URL after. (Greenfield — no file-saver lib; a
  dependency is unnecessary.)
- **Upload/read:** a hidden `<input type="file" accept=".json,application/json">` (or a
  top-level `input[type=file]` in the dashboard) read with `FileReader.readAsText`.
- **Insertion for `new`:** compute a fresh `Project.id` (`crypto.randomUUID()`), create maps
  and insert via `db.projects.add`, `db.scenes.bulkAdd`, `db.tiles.bulkAdd`,
  `db.sprites.bulkAdd`, `db.folders.bulkAdd`, `db.sessions.put` within a single Dexie
  transaction so the import is atomic. Dexie returns new numeric ids so the old→new maps are
  built from returned values.
- **Insertion for `replace`:** delete the target project **including its `folders` rows**
  (`ProjectService.delete` does NOT cascade to `folders` — see
  `project.service.ts:110-117`), then run the same insert path with the chosen
  `Project.id`, remapping to it.

### Data access via existing services

Reusing existing service methods keeps the export consistent with app semantics:

- `ProjectService.getById`
- `SceneService.getScenes`, `getFolders`
- `TileService.getTiles`, `getSpritesForTile` (or `TileSpritesService`)
- `SessionService.getSession`
- Direct Dexie `db.*.add`/`bulkAdd` for the transactional insert (services lack bulk
  insert / cross-table transaction helpers).

Controversy note (resolved): a feature-private export service would normally live in
`features/dashboard/services/`, but export/import is a **cross-feature capability** (used by
dashboard, later possibly per-element) and needs root provisioning, so it belongs in
`core/services/` per the AGENTS.md singleton rule.

### UI: dashboard

- **Export:** a button per project (and/or a dashboard-level entry) "Export". On click,
  `notification.success('Project exported')`; on failure
  `notification.error('Export failed: ...')`.
- **Import:** a dashboard "Import" button that opens a file picker, then a small dialog
  presenting the two modes:
  - **Create new project** (default)
  - **Overwrite existing** — the user picks an existing project; this path goes through
    `rk-confirm-dialog` before running.
- Follow the design system: `rk-dialog` (native `<dialog>`), `rk-confirm-dialog` for the
  destructive overwrite, Material Symbols icons (`download`, `upload`/`file_open`), token
  colors only.

## Data model changes

None. `Project`, `Scene`, `Layer`, `Tile`, `Sprite`, `Folder`, `Session` are all JSON-safe
and exported as-is (with id remapping on import). No DB migration.

## Testing

### project-export.service.spec.ts

- **Export:** assembles a full envelope from a seeded project (create project + 1 scene
  with a layer, 1 tile, 1 sprite with base64 `pixelData`, 1 folder, 1 session); asserts the
  produced JSON contains the project, all folders/scenes/tiles/sprites, the session, the
  format/version fields, and the sprite's exact `pixelData`.
- **Import → new:** imports the fixture into an empty in-memory DB, then asserts a new
  project exists with all children, `Sprite.pixelData` round-trips exactly, tile/sprite ids
  have **no collision** with pre-existing rows, and every `tileData`/`spriteIds`/`tileId`/
  `projectId` reference is consistent after remapping.
- **Import → replace:** imports over a selected project; asserts the old project's children
  are gone (including folders) and the new dataset is in place under the target id.
- **Validation:** malformed JSON / missing `format` field is rejected with a
  `NotificationService.error`.
- **Cross-references:** after either import, verify `tile.spriteIds` point at sprites whose
  `tileId` points back at the tile (bidirectional consistency).

### Dashboard UI

- Export button triggers the download and shows a success toast.
- Import with the "new" mode creates a project visible on the dashboard.
- Overwrite mode requires confirmation and then replaces the project.

## Performance considerations

- `tileData` grids embed numeric tile ids and are dense `number[][]`; JSON size scales with
  scene area × layers. For typical scenes this is small; no streaming needed at v1.
- `bulkAdd` in one transaction keeps import `O(n)` and atomic; failure rolls back the whole
  project.
- Base64 sprites inflate the JSON ~33% vs raw pixels, but `pixelData` is already stored
  base64 so the file is a faithful, non-inflated serialization of what already exists.

## Out of scope

- Per-element export (single scene / tile / sprite). Whole-project only at v1.
- Cloud sync, incremental/delta export, auto-backup scheduling.
- Streaming / chunked export for very large projects (revisit if size becomes an issue).
- PWA-manifest / branding concerns (tracked separately in #24).
- Exporting the global theme (`localStorage`) — app preference, not project data.
