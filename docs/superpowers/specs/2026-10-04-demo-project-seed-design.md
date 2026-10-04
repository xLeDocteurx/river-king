# Demo Project Seed — Design

- **Date:** 2026-10-04
- **Status:** Draft
- **Linked issue:** #70 (Seed a demo project on first run)
- **Epic:** —
- **Related:** #69 (cascade delete prerequisite — merged), #54 (Y-sort render will consume the ySort tree tiles)

## Problem

A fresh install of River King boots to an empty dashboard (« No projects yet »). There is
nothing to explore until the user hand-crafts a project, a palette, sprites, tiles, and a
scene. First-run users never see the engine's rendering capabilities (animated tiles,
blocking, interactable tiles, overhanging/ySort tiles) demonstrated.

## User story

As a new user, when I open the app for the first time, I find a ready-to-open **Demo**
project on the dashboard so I can immediately explore a working scene with animated water,
overhanging trees, a blocking boulder, and an interactable sign.

## Design decisions

1. **Dashboard-only, no auto-open** — the demo is a normal dashboard card, opened like any
   project. No badge, no auto-navigation into the editor.
2. **Nothing but code** — all art is generated procedurally at seed time (canvas → data
   URIs via `encodePixelData`). No bundled binary assets, no DB migration.
3. **Seed once, deletable forever** — a `localStorage` marker `rk-demo-seeded` is set on the
   first bootstrap pass, whether the seed ran (empty DB) or the base was already populated.
   Deleting the demo later never resurrects it.
4. **Core service, direct Dexie transaction** — `DemoProjectService` lives in
   `core/services/`. Core must not import from `features/`, so the seed writes directly to
   the DB tables inside one atomic Dexie transaction, building objects from the `shared/`
   models — it does not reuse the feature CRUD services.
5. **Real interactable action** — a `demo` action in `GAME_ACTIONS` shows a toast via the
   injected `NotificationService` (registry is DI-free today → add `registerGameAction`).

## Architecture

### `core/services/demo-project.service.ts` (new, root-provided)

```ts
async ensureDemo(): Promise<void> {
  if (localStorage.getItem('rk-demo-seeded')) return;       // idempotent forever
  let seeded = false;
  try {
    const count = await this.db.projects.count();
    if (count === 0) { await this.seed(); seeded = true; }
    localStorage.setItem('rk-demo-seeded', 'true');          // set whether seeded or not
  } catch (e) {
    this.notify.error('Failed to set up the demo project');
    // marker left unset → retried next session
  }
}
```

- Called once at boot: `App` (rk-root) becomes `implements OnInit` and fires
  `void this.demo.ensureDemo()` (non-blocking, never awaited by the UI).
- Guarded internally against concurrent/re-entrant calls (in-flight `boolean`).

### Seed content (one atomic transaction over projects/scenes/sprites/tiles)

- Palette: `sweetie-16` from `core/palettes/lospec-palettes.ts`, normalized to `#hex`.
- Project **« Demo »**, `tileSize: 16`, `mapWidth/mapHeight: 24×18`.
- Scene **« Demo Scene »**, 24×18, `spawnPoint: null`, folder `''`:
  - layer **Background**: grass everywhere
  - layer **Overhead**: water pond (4×3), a row of ySort trees along the top, one boulder,
    one sign; empty cells are `-1`
- **7 sprites 16×16** built from `paletteIndices` + `encodePixelData(indices, palette)`:
  grass, water frame 1, water frame 2, trunk, foliage, boulder, sign.
- **6 tiles** (`createTile`-shaped defaults, `animationSpeed` 4 = engine default):

  | Tile    | type     | spriteIds        | properties                            |
  | ------- | -------- | ---------------- | ------------------------------------- |
  | Grass   | static   | [grass]          | {} all false                          |
  | Water   | animated | [w1, w2]         | blocking true                         |
  | Tree    | static   | [trunk, foliage] | blocking true, **ySort true**         |
  | Boulder | static   | [boulder]        | blocking true                         |
  | Sign    | static   | [sign]           | interactable true, `actionId: 'demo'` |

- Tiles/sprites get deterministic ids (auto-increment tables: capture `db.tiles.add(...)`
  return values; sprites reference their owning tile id).

### `core/actions/game-actions.ts` (modify)

- Add `registerGameAction(id: string, handler: GameActionHandler): void` (mutable
  registry; last registration wins).
- Boot wiring: after `ensureDemo()`, `registerGameAction('demo', () =>
this.notify.info('This is the River King demo project.'))`.

## Testing

- **`demo-project.service.spec.ts`**: empty DB → seeds fully (project « Demo », 1 scene
  with 2 layers, 7 sprites, 5 tiles incl. animated Water + ySort Tree + interactable Sign),
  marker set, `projects.count() === 1`; marker present → no seed ever again; populated base
  (marker absent) → marker set, nothing seeded; re-entrancy no-op; failure → `notify.error`
  called and marker not set (retry next session).
- **`game-actions.spec.ts`**: `registerGameAction` adds/overwrites entries; `runGameAction`
  still no-ops for unknown ids.
- Seed data satisfies `Scene`, `Sprite`, `Tile` interfaces (type-check via build).

## Manual QA

1. Fresh browser (empty IndexedDB + empty localStorage) → dashboard shows one « Demo » card.
2. Open Demo → scene renders: green ground, animated pond (2-frame), trees overlapping the
   ground line, boulder, sign.
3. Enter Play mode → water animates; walking into/signing near the sign triggers the demo
   toast; boulder blocks; trees (ySort) will depth-sort once #54 lands.
4. Delete the Demo project → dashboard empty again; reload the app → no demo resurrects.

## Out of scope

- Y-sort **rendering** (#54) — the trees are flagged now, sorted later.
- Auto-open of the demo (dashboard-only by design).
- Folder structure examples (scene/tile folders stay empty).
- Any UI badge or « delete protected » behavior.
