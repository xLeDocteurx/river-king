# Task 2: Domain Models

**Files:**

- Create: `src/app/shared/models/project.model.ts`
- Create: `src/app/shared/models/scene.model.ts`
- Create: `src/app/shared/models/tile.model.ts`
- Create: `src/app/shared/models/sprite.model.ts`
- Create: `src/app/shared/models/session.model.ts`
- Modify: `src/app/shared/models/README.md`

**Context:**
This is Task 2 of a multi-task Angular 22 game engine build. Task 1 is complete (DatabaseService with Dexie.js schema exists at `src/app/core/services/database.service.ts` and uses these models — the imports currently don't resolve because these files don't exist yet). These models are pure TypeScript interfaces with no runtime logic.

**Interfaces:**

- Consumes: None (pure types)
- Produces: All domain model types exported from `shared/models/`
- **IMPORTANT**: Later tasks (Task 3: ProjectService, Task 8: Scene Editor) import these exact paths and type names. Do not rename.

---

## Step 1: Create all model files

Use these EXACT interfaces (copy verbatim):

**`src/app/shared/models/project.model.ts`**

```typescript
export interface Project {
  id: string;
  name: string;
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  palette: string[]; // hex colors
  tileSize: number; // default 16
  mapWidth: number; // default 40 tiles
  mapHeight: number; // default 30 tiles
}
```

**`src/app/shared/models/scene.model.ts`**

```typescript
export interface Scene {
  id: string;
  projectId: string;
  name: string;
  folderPath: string; // "forest/caves" or ""
  width: number; // in tiles
  height: number; // in tiles
  tileData: number[][]; // 2D array, -1 = empty, >=0 = tile ID
}
```

**`src/app/shared/models/tile.model.ts`**

```typescript
export interface Tile {
  id: number;
  projectId: string;
  name: string;
  type: 'static' | 'animated';
  spriteIds: number[]; // references to Sprite.id
  animationSpeed: number; // ms per frame, default 200
  properties: TileProperties;
}

export interface TileProperties {
  collision: boolean;
  solid: boolean;
  interactable: boolean;
  eventScript?: string;
  layer: 'background' | 'foreground';
}
```

**`src/app/shared/models/sprite.model.ts`**

```typescript
export interface Sprite {
  id: number;
  projectId: string;
  tileId: number;
  width: number; // in pixels
  height: number; // in pixels
  pixelData: string; // base64 PNG
  paletteIndices?: number[][]; // for palette-based editing
}
```

**`src/app/shared/models/session.model.ts`**

```typescript
export interface Session {
  projectId: string;
  lastSceneId: string | null;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
}
```

---

## Step 2: Update models README

Read `src/app/shared/models/README.md` first, then append this section at the end:

```markdown
## Domain Models

- `Project` — Game project metadata and configuration
- `Scene` — Individual game level/scene with tile grid
- `Tile` — Tile definitions with properties and animation settings
- `Sprite` — Pixel art data for tile graphics
- `Session` — Per-project user session state (camera, selected scene)
```

---

## Step 3: Commit

```bash
git add src/app/shared/models/
git commit -m "feat: add domain models for project, scene, tile, sprite, session"
```

---

**Verification:** Run `git log --oneline -3` and print the latest commit hash.

**Report file:** Write a brief status report to `docs/superpowers/plans/task-2-report.md` including:

- Status (DONE / BLOCKED / etc.)
- Files created/modified
- Any issues encountered
- Git commit hash
