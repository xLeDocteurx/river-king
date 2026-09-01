# Export / Import de projet (.rkproj) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre d'exporter un projet River King complet vers un fichier `.rkproj` (JSON aux PNG base64 embarqués) depuis le dashboard, et de l'importer comme nouveau projet ou en remplacement d'un projet existant, avec remappage atomique des IDs auto-incrémentés.

**Architecture:** Un service cœur unique `ProjectIoService` (`core/services/`, `providedIn: 'root'`) possède la sérialisation (`exportProject`), la validation (`parsePreview`) et le remappage (`importProject`), ce dernier dans une transaction Dexie `'rw'` tout-ou-rien. L'UI se limite au dashboard : bouton Export par carte projet (téléchargement Blob) et bouton Import dans le header (file picker + dialog `rk-import-project-dialog`). Un DTO versionné `ProjectArchive` vit dans `shared/models/`.

**Tech Stack:** Angular 22 (standalone, signaux), TypeScript ~6.0, Dexie (IndexedDB), Vitest (via `@angular/build:unit-test`, fake-indexeddb), Tailwind prefixed `tw-`, Material Symbols.

## Global Constraints

- Exécuter toutes les commandes via `devbox run` (jamais `npm` nu).
- Règles de UI (design system) : tokens uniquement (`tw-bg-*`, `tw-border-border`…), UI copy en **anglais**, icônes Material Symbols (`<span class="material-symbols" …>`).
- Dialogues via `rk-dialog` (natif `<dialog>`) uniquement. Erreurs async → `NotificationService.error(message)` ; succès → `notification.success(message)`.
- JSDoc obligatoire sur chaque classe et chaque méthode publique (`@param`/`@returns`/`@throws`). Pas de commentaires superflus dans le code.
- `core/` n'importe jamais `shared/` (data) dans d'autres sens interdits : `core` peut importer `shared/models` (modèles purs) — c'est déjà le cas (`database.service.ts` importe les modèles). `features/` peut importer `core/` et `shared/`.
- Tests : `showModal`/`close` de `HTMLDialogElement` non implémentés par jsdom → polyfill dans chaque nouveau spec qui touche un dialog (cf. détail Task 7). Flush async DB = `await new Promise(r => setTimeout(r, 50))`.
- Lint : ESLint 9 flat config ; jamais de `const self = this` (`no-this-alias`), pas de méthode-syntaxe dans les object literals, pas de fonctions vides.
- Fichiers standards : composant = `*.component.{ts,html,scss,spec.ts}` séparés, jamais inline.
- Noms de fichiers exportés : `river-king-<slug>.rkproj`.
- Autre échec de test connu et HORS PÉRIMÈTRE : `project-create-dialog.component.spec.ts > highlights exactly the selected palette row` (échoue déjà sur `main`, dashboard touché par ce ticket n'y change rien — ne pas chercher à le réparer).

## File Structure

**Créés :**

- `src/app/shared/models/project-archive.model.ts` — DTO `ProjectArchive` + constantes de format/version + item types.
- `src/app/shared/models/project-archive.model.spec.ts` — sanity des constantes.
- `src/app/core/services/project-io.service.ts` — `ProjectIoService`, `ImportMode`, `ImportResult`, `ProjectImportError`, helpers privés.
- `src/app/core/services/project-io.service.spec.ts` — round-trip, import new, validations, replace, rollback.
- `src/app/features/dashboard/import-project-dialog/import-project-dialog.component.ts|html|scss|spec.ts` — dialog d'import.

**Modifiés :**

- `src/app/features/dashboard/project-card.component.ts|html|spec.ts` — bouton Export + téléchargement.
- `src/app/features/dashboard/dashboard.component.ts|html|spec.ts` — bouton Import, file picker, orchestration du dialog.

## Task 1: DTO `ProjectArchive` + constantes

**Files:**

- Create: `src/app/shared/models/project-archive.model.ts`
- Test: `src/app/shared/models/project-archive.model.spec.ts`

**Interfaces:**

- Produces: `PROJECT_ARCHIVE_FORMAT` (le littéral `'river-king-project'`), `PROJECT_ARCHIVE_VERSION` (`1`), interfaces `ProjectArchive`, `ProjectArchiveProjectData`, `TileArchiveItem`, `SpriteArchiveItem`, `SceneArchiveItem`. Ces noms sont consommés par Task 2-5 et par le dialog.

- [ ] **Step 1: Write the failing test**

`src/app/shared/models/project-archive.model.spec.ts` :

```ts
import {
  PROJECT_ARCHIVE_FORMAT,
  PROJECT_ARCHIVE_VERSION,
  type ProjectArchive,
} from './project-archive.model';
import type { TileProperties } from './tile.model';

describe('ProjectArchive model', () => {
  it('exposes the archive format and version constants', () => {
    expect(PROJECT_ARCHIVE_FORMAT).toBe('river-king-project');
    expect(PROJECT_ARCHIVE_VERSION).toBe(1);
  });

  it('describes a complete archive shape', () => {
    const archive: ProjectArchive = {
      format: PROJECT_ARCHIVE_FORMAT,
      formatVersion: PROJECT_ARCHIVE_VERSION,
      exportedAt: 0,
      project: {
        name: 'Heroes',
        palette: ['#ff0000'],
        tileSize: 16,
        mapWidth: 40,
        mapHeight: 30,
      },
      tiles: [
        {
          sourceId: 1,
          name: 'Ground',
          type: 'static',
          spriteIds: [1],
          animationSpeed: 4,
          properties: { blocking: false, interactable: false } satisfies TileProperties,
          folderPath: '',
        },
      ],
      sprites: [
        {
          sourceId: 1,
          tileSourceId: 1,
          name: 'frame 1',
          width: 16,
          height: 16,
          pixelData: 'data:image/png;base64,AAA',
        },
      ],
      scenes: [
        {
          name: 'Level 1',
          folderPath: '',
          width: 10,
          height: 10,
          layers: [
            {
              id: 'l-1',
              name: 'Background',
              visible: true,
              opacity: 1,
              tileData: [[1, -1]],
            },
          ],
        },
      ],
      folders: ['nature'],
    };
    expect(archive.project.name).toBe('Heroes');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npx ng test --watch=false --include='src/app/shared/models/project-archive.model.spec.ts'`
Expected: FAIL — module not found (`Cannot find module './project-archive.model'`).

- [ ] **Step 3: Write the model**

`src/app/shared/models/project-archive.model.ts` :

```ts
import type { TileProperties } from './tile.model';
import type { Layer } from './scene.model';

/**
 * Identifies a River King project archive file.
 */
export const PROJECT_ARCHIVE_FORMAT = 'river-king-project';

/**
 * Current version of the archive format. Bump on any breaking change to the schema.
 */
export const PROJECT_ARCHIVE_VERSION = 1;

/**
 * Project-level fields carried by an archive (identity and timestamps are
 * regenerated on import, so they are not part of the file).
 */
export interface ProjectArchiveProjectData {
  /**
   * Project name, kept as-is on import.
   */
  name: string;
  /**
   * Hex colors (`'#rrggbb'`) of the project palette.
   */
  palette: string[];
  /**
   * Side length in pixels of one tile.
   */
  tileSize: number;
  /**
   * Default map width in tiles.
   */
  mapWidth: number;
  /**
   * Default map height in tiles.
   */
  mapHeight: number;
}

/**
 * A tile as stored in an archive. `sourceId` is the database id at export time,
 * used only to resolve cross-references during import.
 */
export interface TileArchiveItem {
  /**
   * Database tile id at export time.
   */
  sourceId: number;
  /**
   * Display name of the tile.
   */
  name: string;
  /**
   * Whether the tile is static or animated.
   */
  type: 'static' | 'animated';
  /**
   * `sourceId`s of the frames, ordered (playback order).
   */
  spriteIds: number[];
  /**
   * Frames per second when the tile is animated.
   */
  animationSpeed: number;
  /**
   * Collision / interaction settings.
   */
  properties: TileProperties;
  /**
   * Folder path the tile lives in (`''` = root).
   */
  folderPath: string;
}

/**
 * A sprite (single frame) as stored in an archive. `pixelData` is a PNG base64
 * data URI that is preserved byte-for-byte on import.
 */
export interface SpriteArchiveItem {
  /**
   * Database sprite id at export time.
   */
  sourceId: number;
  /**
   * `sourceId` of the owning tile at export time.
   */
  tileSourceId: number;
  /**
   * Frame name.
   */
  name: string;
  /**
   * Sprite width in pixels.
   */
  width: number;
  /**
   * Sprite height in pixels.
   */
  height: number;
  /**
   * PNG base64 data URI of the rendered pixels.
   */
  pixelData: string;
  /**
   * 2D palette-index grid (`n > 0` → `palette[n-1]`, `0`/`-1` = transparent).
   */
  paletteIndices?: number[][];
}

/**
 * A scene as stored in an archive. Layer `tileData` references tile `sourceId`s.
 */
export interface SceneArchiveItem {
  /**
   * Scene name.
   */
  name: string;
  /**
   * Folder path the scene lives in (`''` = root).
   */
  folderPath: string;
  /**
   * Scene width in tiles.
   */
  width: number;
  /**
   * Scene height in tiles.
   */
  height: number;
  /**
   * Ordered layers, bottom to top.
   */
  layers: Layer[];
}

/**
 * Full serialized form of a project, versioned and self-contained.
 */
export interface ProjectArchive {
  /**
   * Must equal {@link PROJECT_ARCHIVE_FORMAT}.
   */
  format: string;
  /**
   * Must equal {@link PROJECT_ARCHIVE_VERSION}.
   */
  formatVersion: number;
  /**
   * Epoch millis at export time (informational only).
   */
  exportedAt: number;
  /**
   * Project-level settings.
   */
  project: ProjectArchiveProjectData;
  /**
   * All tiles of the project.
   */
  tiles: TileArchiveItem[];
  /**
   * All sprites (frames) of the project.
   */
  sprites: SpriteArchiveItem[];
  /**
   * All scenes of the project.
   */
  scenes: SceneArchiveItem[];
  /**
   * Scene folder paths (deduplicated).
   */
  folders: string[];
}
```

Note: the test's `format: PROJECT_ARCHIVE_FORMAT` compares against `string` — the field is typed `string` so the constant needs no `as const`. `formatVersion: number` likewise. This keeps runtime validation in Task 4 as string/number comparisons without literal type friction.

- [ ] **Step 4: Run test to verify it passes**

Run: `devbox run npx ng test --watch=false --include='src/app/shared/models/project-archive.model.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/models/project-archive.model.ts src/app/shared/models/project-archive.model.spec.ts
git commit -m "feature-2: add project archive model (ProjectArchive DTO)"
```

## Task 2: Service — `exportProject`

**Files:**

- Create: `src/app/core/services/project-io.service.ts`
- Test: `src/app/core/services/project-io.service.spec.ts`

**Interfaces:**

- Consumes: `DatabaseService` tables `projects`/`tiles`/`sprites`/`scenes`/`folders`/`sessions`; `ProjectArchive`+ item types + constants (Task 1).
- Produces: `ProjectIoService.exportProject(projectId: string): Promise<string>`; also declares (implemented in Task 3-4): `importProject(fileText: string, mode: ImportMode): Promise<ImportResult>`, `parsePreview(fileText: string): ProjectArchive`, et les types `ImportMode`, `ImportResult`, la classe `ProjectImportError`.

Because Task 3/4 methods are referenced by this file's public surface, define the full type exports now and keep bodies throwing `ProjectImportError('Not implemented until Task 3–4')` for the not-yet-built methods — but since Task 2 is committed alone, keep the file complete and self-consistent: implement `exportProject` fully, stub `parsePreview`/`importProject` with a rejected throw, then expand in later tasks.

- [ ] **Step 1: Write the failing test**

`src/app/core/services/project-io.service.spec.ts` (partial — only export tests now) :

```ts
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { DatabaseService } from './database.service';
import { ProjectIoService, ProjectImportError } from './project-io.service';
import {
  PROJECT_ARCHIVE_FORMAT,
  PROJECT_ARCHIVE_VERSION,
} from '../../shared/models/project-archive.model';
import type { Sprite } from '../../shared/models/sprite.model';

describe('ProjectIoService', () => {
  let db: DatabaseService;
  let service: ProjectIoService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [ProjectIoService],
    }).compileComponents();
    db = TestBed.inject(DatabaseService);
    service = TestBed.inject(ProjectIoService);
    await db.projects.clear();
    await db.scenes.clear();
    await db.tiles.clear();
    await db.sprites.clear();
    await db.sessions.clear();
    await db.folders.clear();
  });

  /** Seeds a representative project. Returns its id plus the first tile id. */
  async function seedProject(): Promise<{ projectId: string; groundId: number }> {
    const projectId = 'proj-1';
    await db.projects.add({
      id: projectId,
      name: 'Heroes',
      createdAt: 1,
      updatedAt: 2,
      palette: ['#ff0000', '#00ff00', '#0000ff', '#ffffff'],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    });
    const groundId = await db.tiles.add({
      projectId,
      name: 'Ground',
      type: 'static',
      spriteIds: [] as number[],
      animationSpeed: 4,
      properties: { blocking: false, interactable: false },
      folderPath: '',
    });
    const waterId = await db.tiles.add({
      projectId,
      name: 'Water',
      type: 'animated',
      spriteIds: [] as number[],
      animationSpeed: 8,
      properties: { blocking: true, interactable: true, actionId: 'talk' },
      folderPath: 'nature',
    });
    const groundSpriteId = await db.sprites.add({
      id: groundId,
      projectId,
      tileId: groundId,
      name: 'Ground frame',
      width: 16,
      height: 16,
      pixelData: 'data:image/png;base64,AAA',
      paletteIndices: [
        [0, 1],
        [1, 0],
      ],
    } as Sprite);
    const water1 = await db.sprites.add({
      projectId,
      tileId: waterId,
      name: 'Water 1',
      width: 16,
      height: 16,
      pixelData: 'data:image/png;base64,BBB',
    } as Sprite);
    const water2 = await db.sprites.add({
      projectId,
      tileId: waterId,
      name: 'Water 2',
      width: 16,
      height: 16,
      pixelData: 'data:image/png;base64,CCC',
    } as Sprite);
    await db.tiles.update(groundId, { spriteIds: [groundSpriteId] });
    await db.tiles.update(waterId, { spriteIds: [water1, water2] });
    await db.folders.add({ id: 'f-1', projectId, path: 'nature' });
    await db.scenes.add({
      id: 's-1',
      projectId,
      name: 'Level 1',
      folderPath: '',
      width: 10,
      height: 10,
      layers: [
        {
          id: 'l-1',
          name: 'Background',
          visible: true,
          opacity: 1,
          tileData: [
            [groundId, -1],
            [-1, waterId],
          ],
        },
      ],
    });
    return { projectId, groundId };
  }

  it('exports a complete, deterministic archive string', async () => {
    const { projectId } = await seedProject();
    const json = await service.exportProject(projectId);

    const archive = JSON.parse(json) as {
      format: string;
      formatVersion: number;
      exportedAt: number;
      project: { name: string; palette: string[]; tileSize: number };
      tiles: { sourceId: number; spriteIds: number[]; folderPath: string }[];
      sprites: { sourceId: number; pixelData: string }[];
      scenes: { name: string; layers: { tileData: number[][] }[] }[];
      folders: string[];
    };

    expect(archive.format).toBe(PROJECT_ARCHIVE_FORMAT);
    expect(archive.formatVersion).toBe(PROJECT_ARCHIVE_VERSION);
    expect(archive.project.name).toBe('Heroes');
    expect(archive.project.palette).toEqual(['#ff0000', '#00ff00', '#0000ff', '#ffffff']);
    expect(archive.project.tileSize).toBe(16);
    expect(archive.tiles).toHaveLength(2);
    expect(archive.tiles[0].spriteIds).toEqual([archive.tiles[0].sourceId]);
    expect(archive.tiles[1].spriteIds).toHaveLength(2);
    expect(archive.tiles[1].folderPath).toBe('nature');
    expect(archive.sprites).toHaveLength(3);
    expect(archive.sprites[0].pixelData).toBe('data:image/png;base64,AAA');
    expect(archive.scenes).toHaveLength(1);
    expect(archive.scenes[0].layers[0].tileData).toEqual([
      [archive.tiles[0].sourceId, -1],
      [-1, archive.tiles[1].sourceId],
    ]);
    expect(archive.folders).toEqual(['nature']);
  });

  it('throws a reference error when exporting an unknown project', async () => {
    await expect(service.exportProject('ghost')).rejects.toThrow(/not found/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npx ng test --watch=false --include='src/app/core/services/project-io.service.spec.ts'`
Expected: FAIL — module not found (`Cannot find module './project-io.service'`).

- [ ] **Step 3: Write the service (export + type surface + stubs)**

`src/app/core/services/project-io.service.ts` :

```ts
import { Injectable, inject } from '@angular/core';
import { DatabaseService } from './database.service';
import {
  PROJECT_ARCHIVE_FORMAT,
  PROJECT_ARCHIVE_VERSION,
  type ProjectArchive,
  type SceneArchiveItem,
  type SpriteArchiveItem,
  type TileArchiveItem,
} from '../../shared/models/project-archive.model';

/**
 * Import target choice: a brand-new project or an in-place replacement.
 */
export type ImportMode =
  /**
   * Create a fresh project with a new UUID.
   */
  | { kind: 'new' }
  /**
   * Replace the content of an existing project, keeping its UUID.
   */
  | { kind: 'replace'; targetProjectId: string };

/**
 * Outcome of a successful import.
 */
export interface ImportResult {
  /**
   * Id of the project that received the imported content.
   */
  projectId: string;
  /**
   * Whether the project was created fresh or replaced.
   */
  kind: 'new' | 'replace';
}

/**
 * Raised when an archive file cannot be imported, with a user-readable message.
 */
export class ProjectImportError extends Error {}

/**
 * Type guard for plain objects.
 * @param value - The value to inspect.
 * @returns True when the value is a non-null object (incl. arrays).
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Owns project serialization: exports a project to a `.rkproj` JSON string,
 * validates archives, and imports them with full atomic id remapping.
 */
@Injectable({ providedIn: 'root' })
export class ProjectIoService {
  private readonly db = inject(DatabaseService);

  /**
   * Serializes a whole project (settings, tiles, sprites, scenes, folders)
   * into a deterministic JSON string with embedded PNG base64 frames.
   * @param projectId - Id of the project to export.
   * @returns The archive JSON string.
   * @throws Error when the project does not exist.
   */
  async exportProject(projectId: string): Promise<string> {
    const [project, tiles, sprites, folders, scenes] = await Promise.all([
      this.db.projects.get(projectId),
      this.db.tiles.where('projectId').equals(projectId).sortBy('id'),
      this.db.sprites.where('projectId').equals(projectId).sortBy('id'),
      this.db.folders.where('projectId').equals(projectId).toArray(),
      this.db.scenes.where('projectId').equals(projectId).toArray(),
    ]);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    const archive: ProjectArchive = {
      format: PROJECT_ARCHIVE_FORMAT,
      formatVersion: PROJECT_ARCHIVE_VERSION,
      exportedAt: Date.now(),
      project: {
        name: project.name,
        palette: [...project.palette],
        tileSize: project.tileSize,
        mapWidth: project.mapWidth,
        mapHeight: project.mapHeight,
      },
      tiles: tiles.map((t): TileArchiveItem => ({
        sourceId: t.id,
        name: t.name,
        type: t.type,
        spriteIds: [...t.spriteIds],
        animationSpeed: t.animationSpeed,
        properties: { ...t.properties },
        folderPath: t.folderPath ?? '',
      })),
      sprites: sprites.map((s): SpriteArchiveItem => ({
        sourceId: s.id,
        tileSourceId: s.tileId,
        name: s.name,
        width: s.width,
        height: s.height,
        pixelData: s.pixelData,
        paletteIndices: s.paletteIndices?.map((row) => [...row]),
      })),
      scenes: scenes.map((sc): SceneArchiveItem => ({
        name: sc.name,
        folderPath: sc.folderPath,
        width: sc.width,
        height: sc.height,
        layers: sc.layers.map((l) => ({
          id: l.id,
          name: l.name,
          visible: l.visible,
          opacity: l.opacity,
          tileData: l.tileData.map((row) => [...row]),
        })),
      })),
      folders: [...new Set(folders.map((f) => f.path))],
    };
    return JSON.stringify(archive);
  }

  /**
   * Validates an archive file and returns its parsed, structure-checked form.
   * @param fileText - Raw file content.
   * @returns The validated archive.
   * @throws ProjectImportError with a user-facing message.
   */
  parsePreview(fileText: string): ProjectArchive {
    return this.validate(fileText);
  }

  /**
   * Imports an archive file into the database.
   * @param fileText - Raw file content.
   * @param mode - Fresh project or replace an existing one.
   * @returns The id of the project that received the content.
   * @throws ProjectImportError when the file is invalid.
   */
  async importProject(fileText: string, mode: ImportMode): Promise<ImportResult> {
    void mode;
    throw new ProjectImportError('Import is not implemented yet');
  }

  private validate(_fileText: string): ProjectArchive {
    throw new ProjectImportError('Import is not implemented yet');
  }
}
```

- [ ] **Step 4: Run export tests to verify they pass**

Run: `devbox run npx ng test --watch=false --include='src/app/core/services/project-io.service.spec.ts'`
Expected: 2 passed (export happy path + unknown project).

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/project-io.service.ts src/app/core/services/project-io.service.spec.ts
git commit -m "feature-2: add ProjectIoService with project export"
```

## Task 3: Import as new project (atomic remap)

**Files:**

- Modify: `src/app/core/services/project-io.service.ts`
- Test: `src/app/core/services/project-io.service.spec.ts`

**Interfaces:**

- Consumes: `importProject(fileText, mode)`, `ImportMode`/`ImportResult`, `parsePreview` surface from Task 2.
- Produces: full working `importProject` for `{kind: 'new'}`; the private helpers `validate()` (structural part without cross-reference checks — added in Task 4) and `purgeProject(projectId)` (used here and by Task 5), plus a working `parsePreview`.

- [ ] **Step 1: Write the failing test (new-project import)**

Append to `src/app/core/services/project-io.service.spec.ts` :

```ts
import { ProjectArchive } from '../../shared/models/project-archive.model';
import type { Scene } from '../../shared/models/scene.model';
import type { Tile } from '../../shared/models/tile.model';
import type { Folder } from '../../shared/models/folder.model';

/** Imports seed data (see seedProject) as a fresh project and returns it. */
async function importFresh(): Promise<{
  archive: ProjectArchive;
  result: { projectId: string; kind: 'new' | 'replace' };
}> {
  const { projectId } = await seedProject();
  const json = await service.exportProject(projectId);
  await db.projects.clear();
  await db.scenes.clear();
  await db.tiles.clear();
  await db.sprites.clear();
  await db.sessions.clear();
  await db.folders.clear();
  const archive = JSON.parse(json) as ProjectArchive;
  const result = await service.importProject(json, { kind: 'new' });
  return { archive, result };
}
```

Then the tests:

```ts
it('imports as a new project with remapped ids and preserved content', async () => {
  const { archive, result } = await importFresh();

  expect(result.kind).toBe('new');
  expect(result.projectId).toBeTruthy();
  expect(result.projectId).not.toBe('proj-1');

  const project = await db.projects.get(result.projectId);
  expect(project?.name).toBe('Heroes');
  expect(project?.palette).toEqual(['#ff0000', '#00ff00', '#0000ff', '#ffffff']);
  expect(project?.tileSize).toBe(16);
  expect(project?.mapWidth).toBe(40);
  expect(project?.mapHeight).toBe(30);

  const tiles = await db.tiles.where('projectId').equals(result.projectId).toArray();
  expect(tiles).toHaveLength(2);
  for (const tile of tiles) {
    expect(archive.tiles.some((t) => t.name === tile.name && t.type === tile.type)).toBe(true);
    expect(tile.spriteIds.length).toBeGreaterThan(0);
    for (const sid of tile.spriteIds) {
      const sprite = await db.sprites.get(sid);
      expect(sprite?.tileId).toBe(tile.id);
    }
  }

  const sprites = await db.sprites.where('projectId').equals(result.projectId).toArray();
  for (const sprite of sprites) {
    const tile = await db.tiles.get(sprite.tileId);
    expect(tile?.spriteIds).toContain(sprite.id);
  }
  const groundSprite = sprites.find((s) => s.name === 'Ground frame');
  expect(groundSprite?.pixelData).toBe('data:image/png;base64,AAA');
  expect(groundSprite?.paletteIndices).toEqual([
    [0, 1],
    [1, 0],
  ]);
  const waterSprites = sprites
    .filter((s) => s.name.startsWith('Water'))
    .sort((a, b) => a.name.localeCompare(b.name));
  expect(waterSprites.map((s) => s.name)).toEqual(['Water 1', 'Water 2']);

  const waterTile = tiles.find((t) => t.name === 'Water');
  const waterSpriteIds = waterTile!.spriteIds;
  expect(waterSprites.map((s) => s.id)).toEqual(waterSpriteIds);

  const scenes = await db.scenes.where('projectId').equals(result.projectId).toArray();
  expect(scenes).toHaveLength(1);
  const level = scenes[0];
  expect(level.name).toBe('Level 1');
  const groundNewId = tiles.find((t) => t.name === 'Ground')!.id;
  const waterNewId = waterTile!.id;
  expect(level.layers[0].tileData).toEqual([
    [groundNewId, -1],
    [-1, waterNewId],
  ]);

  const folders = await db.folders.where('projectId').equals(result.projectId).toArray();
  expect(folders.map((f: Folder) => f.path)).toEqual(['nature']);

  expect((await db.sessions.toArray()).length).toBe(0);
});

it('supports importing the same file twice as two distinct projects', async () => {
  const { json } = (async () => ({
    json: await service.exportProject((await seedProject()).projectId),
  }))() as unknown as { json: string };
  await db.projects.clear();
  await db.scenes.clear();
  await db.tiles.clear();
  await db.sprites.clear();
  await db.sessions.clear();
  await db.folders.clear();

  const first = await service.importProject(json, { kind: 'new' });
  const second = await service.importProject(json, { kind: 'new' });
  expect(first.projectId).not.toBe(second.projectId);

  const [t1, t2] = await Promise.all([
    db.tiles.where('projectId').equals(first.projectId).count(),
    db.tiles.where('projectId').equals(second.projectId).count(),
  ]);
  expect(t1).toBe(2);
  expect(t2).toBe(2);
});
```

Note: the duplicate-import test reads `seedProject()` again but only needs the exported JSON; keep it simple by re-exporting after seeding. (The snippet above is intentionally compact; adjustable for clarity.)

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npx ng test --watch=false --include='src/app/core/services/project-io.service.spec.ts'`
Expected: new tests FAIL with `'Import is not implemented yet'`.

- [ ] **Step 3: Implement `validate` (structural) + `importProject` (new mode) + `purgeProject`**

Replace the two stubs in `src/app/core/services/project-io.service.ts`. Add helpers `validateArchives` (to be extended in Task 4), `purgeProject`. Implementation:

```ts
  /**
   * Imports an archive file into the database.
   * @param fileText - Raw file content.
   * @param mode - Fresh project or replace an existing one.
   * @returns The id of the project that received the content.
   * @throws ProjectImportError when the file is invalid.
   */
  async importProject(fileText: string, mode: ImportMode): Promise<ImportResult> {
    const archive = this.validate(fileText);
    const projectId = mode.kind === 'new' ? crypto.randomUUID() : mode.targetProjectId;
    const now = Date.now();
    const projectRow = {
      id: projectId,
      name: archive.project.name,
      createdAt: now,
      updatedAt: now,
      palette: [...archive.project.palette],
      tileSize: archive.project.tileSize,
      mapWidth: archive.project.mapWidth,
      mapHeight: archive.project.mapHeight,
    };

    const tileIdMap = new Map<number, number>();
    const spriteIdMap = new Map<number, number>();

    await this.db.transaction(
      'rw',
      this.db.projects,
      this.db.tiles,
      this.db.sprites,
      this.db.scenes,
      this.db.folders,
      this.db.sessions,
      async () => {
        if (mode.kind === 'replace') {
          await this.purgeProject(projectId);
        }
        for (const t of archive.tiles) {
          const newId = await this.db.tiles.add({
            projectId,
            name: t.name,
            type: t.type,
            spriteIds: [] as number[],
            animationSpeed: t.animationSpeed,
            properties: { ...t.properties },
            folderPath: t.folderPath,
          });
          tileIdMap.set(t.sourceId, newId);
        }
        for (const s of archive.sprites) {
          const newId = await this.db.sprites.add({
            projectId,
            tileId: tileIdMap.get(s.tileSourceId)!,
            name: s.name,
            width: s.width,
            height: s.height,
            pixelData: s.pixelData,
            paletteIndices: s.paletteIndices?.map((row) => [...row]),
          });
          spriteIdMap.set(s.sourceId, newId);
        }
        for (const t of archive.tiles) {
          const newId = tileIdMap.get(t.sourceId)!;
          await this.db.tiles.update(newId, {
            spriteIds: t.spriteIds.map((sid) => spriteIdMap.get(sid)!),
          });
        }
        for (const sc of archive.scenes) {
          await this.db.scenes.add({
            id: crypto.randomUUID(),
            projectId,
            name: sc.name,
            folderPath: sc.folderPath,
            width: sc.width,
            height: sc.height,
            layers: sc.layers.map((l) => ({
              id: l.id,
              name: l.name,
              visible: l.visible,
              opacity: l.opacity,
              tileData: l.tileData.map((row) =>
                row.map((tid) => (tid < 0 ? tid : tileIdMap.get(tid)!)),
              ),
            })),
          });
        }
        for (const path of archive.folders) {
          await this.db.folders.add({
            id: crypto.randomUUID(),
            projectId,
            path,
          });
        }
        await this.db.projects.delete(projectId);
        await this.db.projects.add(projectRow);
      },
    );

    return { projectId, kind: mode.kind };
  }

  /**
   * Deletes every row belonging to a project (scenes, tiles, sprites, folders,
   * sessions — project row excluded).
   * @param projectId - The project to purge.
   */
  private async purgeProject(projectId: string): Promise<void> {
    await this.db.scenes.where('projectId').equals(projectId).delete();
    await this.db.tiles.where('projectId').equals(projectId).delete();
    await this.db.sprites.where('projectId').equals(projectId).delete();
    await this.db.folders.where('projectId').equals(projectId).delete();
    await this.db.sessions.where('projectId').equals(projectId).delete();
  }

  /**
   * Parses and structurally validates an archive file.
   * @param fileText - Raw file content.
   * @returns The validated archive.
   * @throws ProjectImportError with a user-facing message.
   */
  private validate(fileText: string): ProjectArchive {
    let raw: unknown;
    try {
      raw = JSON.parse(fileText);
    } catch {
      throw new ProjectImportError('This file is not a valid project file.');
    }
    if (!isRecord(raw) || raw.format !== PROJECT_ARCHIVE_FORMAT) {
      throw new ProjectImportError('This file is not a River King project export.');
    }
    if (raw.formatVersion !== PROJECT_ARCHIVE_VERSION) {
      throw new ProjectImportError(
        `This project file uses an unsupported version (${String(raw.formatVersion)}).`,
      );
    }
    if (!isRecord(raw.project)) {
      throw new ProjectImportError('This file is missing required data.');
    }
    const p = raw.project;
    if (
      typeof p.name !== 'string' ||
      p.name.length === 0 ||
      !Array.isArray(p.palette) ||
      p.palette.some((c) => typeof c !== 'string') ||
      typeof p.tileSize !== 'number' ||
      typeof p.mapWidth !== 'number' ||
      typeof p.mapHeight !== 'number'
    ) {
      throw new ProjectImportError('This file is missing required data.');
    }
    if (!Array.isArray(raw.tiles) || !Array.isArray(raw.sprites)) {
      throw new ProjectImportError('This file is missing required data.');
    }
    if (!Array.isArray(raw.scenes) || !Array.isArray(raw.folders)) {
      throw new ProjectImportError('This file is missing required data.');
    }
    return raw as unknown as ProjectArchive;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `devbox run npx ng test --watch=false --include='src/app/core/services/project-io.service.spec.ts'`
Expected: all export + new-import tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/project-io.service.ts src/app/core/services/project-io.service.spec.ts
git commit -m "feature-2: implement project import as new project with id remap"
```

## Task 4: Validation strictes (structure + intégrité des références)

**Files:**

- Modify: `src/app/core/services/project-io.service.ts` (extend `validate`)
- Test: `src/app/core/services/project-io.service.spec.ts`

**Interfaces:**

- Produces: `validate()` now also checks tile/sprite/scene item shapes and cross-reference integrity (unknown `tileSourceId`, unknown `spriteIds`, unknown `tileData`); `importProject` and `parsePreview` reject such files.

- [ ] **Step 1: Write the failing tests**

Append to `src/app/core/services/project-io.service.spec.ts` :

```ts
function validJsonOverrides(overrides: Record<string, unknown>): string {
  const base = {
    format: PROJECT_ARCHIVE_FORMAT,
    formatVersion: PROJECT_ARCHIVE_VERSION,
    exportedAt: 0,
    project: {
      name: 'Heroes',
      palette: ['#ff0000'],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    },
    tiles: [
      {
        sourceId: 1,
        name: 'Ground',
        type: 'static',
        spriteIds: [11],
        animationSpeed: 4,
        properties: { blocking: false, interactable: false },
        folderPath: '',
      },
    ],
    sprites: [
      {
        sourceId: 11,
        tileSourceId: 1,
        name: 'frame 1',
        width: 16,
        height: 16,
        pixelData: 'data:image/png;base64,AAA',
      },
    ],
    scenes: [
      {
        name: 'Level 1',
        folderPath: '',
        width: 10,
        height: 10,
        layers: [
          {
            id: 'l-1',
            name: 'Background',
            visible: true,
            opacity: 1,
            tileData: [[1, -1]],
          },
        ],
      },
    ],
    folders: [],
  };
  return JSON.stringify({ ...base, ...overrides });
}

async function expectImportRejected(json: string, message: string): Promise<void> {
  await expect(service.importProject(json, { kind: 'new' })).rejects.toThrow(
    new ProjectImportError(message),
  );
}
```

Tests:

```ts
it('rejects files that are not valid JSON', async () => {
  await expectImportRejected('not-json', 'This file is not a valid project file.');
});

it('rejects files that are not river king exports', async () => {
  await expectImportRejected(
    JSON.stringify({ hello: 'world' }),
    'This file is not a River King project export.',
  );
});

it('rejects unsupported format versions', async () => {
  const json = validJsonOverrides({ formatVersion: 99 });
  await expectImportRejected(json, 'This project file uses an unsupported version (99).');
});

it('rejects archives missing required data', async () => {
  const noName = validJsonOverrides({
    project: { palette: [], tileSize: 16, mapWidth: 40, mapHeight: 30 },
  });
  await expectImportRejected(noName, 'This file is missing required data.');

  const noTiles = validJsonOverrides({ tiles: undefined });
  await expectImportRejected(noTiles, 'This file is missing required data.');
});

it('rejects sprites referencing a missing tile', async () => {
  const json = validJsonOverrides({
    sprites: [{ ...validSprite(), tileSourceId: 999 }],
  });
  await expectImportRejected(json, 'This file references a missing tile.');
});

it('rejects tiles referencing a missing frame', async () => {
  const json = validJsonOverrides({
    tiles: [{ ...validTile(), spriteIds: [777] }],
  });
  await expectImportRejected(json, 'This file references a missing frame.');
});

it('rejects scenes referencing a missing tile in tileData', async () => {
  const json = validJsonOverrides({
    scenes: [
      {
        name: 'Level 1',
        folderPath: '',
        width: 10,
        height: 10,
        layers: [
          {
            id: 'l-1',
            name: 'Background',
            visible: true,
            opacity: 1,
            tileData: [[999, -1]],
          },
        ],
      },
    ],
  });
  await expectImportRejected(json, 'This file references a missing tile.');
});
```

Where `validTile()` / `validSprite()` are small local helpers returning the base objects used above (extract them from `validJsonOverrides`):

```ts
function validTile() {
  return {
    sourceId: 1,
    name: 'Ground',
    type: 'static' as const,
    spriteIds: [11],
    animationSpeed: 4,
    properties: { blocking: false, interactable: false },
    folderPath: '',
  };
}

function validSprite() {
  return {
    sourceId: 11,
    tileSourceId: 1,
    name: 'frame 1',
    width: 16,
    height: 16,
    pixelData: 'data:image/png;base64,AAA',
  };
}
```

(Adjust `validJsonOverrides` base to reuse `validTile()`/`validSprite()` — spread them in.)

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npx ng test --watch=false --include='src/app/core/services/project-io.service.spec.ts'`
Expected: the new strict tests FAIL (structural validation currently passes them: tiles/scenes present, names present, etc.). The "not JSON", "not river king" and "unsupported version" may already PASS — that's fine, TDD still holds for the integrity checks.

- [ ] **Step 3: Extend `validate` with shape + integrity checks**

After the existing `return raw as unknown as ProjectArchive;` line, replace it with shape validation + cross-reference integrity before returning:

```ts
const archive = raw as unknown as ProjectArchive;
for (const t of archive.tiles) {
  if (
    typeof t.sourceId !== 'number' ||
    typeof t.name !== 'string' ||
    (t.type !== 'static' && t.type !== 'animated') ||
    !Array.isArray(t.spriteIds) ||
    t.spriteIds.some((id) => typeof id !== 'number') ||
    typeof t.animationSpeed !== 'number' ||
    !isRecord(t.properties) ||
    typeof t.folderPath !== 'string'
  ) {
    throw new ProjectImportError('This file is missing required data.');
  }
}
for (const s of archive.sprites) {
  if (
    typeof s.sourceId !== 'number' ||
    typeof s.tileSourceId !== 'number' ||
    typeof s.name !== 'string' ||
    typeof s.width !== 'number' ||
    typeof s.height !== 'number' ||
    typeof s.pixelData !== 'string'
  ) {
    throw new ProjectImportError('This file is missing required data.');
  }
}
for (const sc of archive.scenes) {
  if (
    typeof sc.name !== 'string' ||
    typeof sc.folderPath !== 'string' ||
    typeof sc.width !== 'number' ||
    typeof sc.height !== 'number' ||
    !Array.isArray(sc.layers) ||
    sc.layers.some((l) => !Array.isArray(l.tileData))
  ) {
    throw new ProjectImportError('This file is missing required data.');
  }
}
const tileIds = new Set(archive.tiles.map((t) => t.sourceId));
const spriteIds = new Set(archive.sprites.map((s) => s.sourceId));
for (const s of archive.sprites) {
  if (!tileIds.has(s.tileSourceId)) {
    throw new ProjectImportError('This file references a missing tile.');
  }
}
for (const t of archive.tiles) {
  for (const sid of t.spriteIds) {
    if (!spriteIds.has(sid)) {
      throw new ProjectImportError('This file references a missing frame.');
    }
  }
}
for (const sc of archive.scenes) {
  for (const layer of sc.layers) {
    for (const row of layer.tileData) {
      for (const tid of row) {
        if (tid >= 0 && !tileIds.has(tid)) {
          throw new ProjectImportError('This file references a missing tile.');
        }
      }
    }
  }
}
return archive;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `devbox run npx ng test --watch=false --include='src/app/core/services/project-io.service.spec.ts'`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/project-io.service.ts src/app/core/services/project-io.service.spec.ts
git commit -m "feature-2: validate archive structure and reference integrity on import"
```

## Task 5: Import replace mode + rollback safety

**Files:**

- Modify: `src/app/core/services/project-io.service.ts` (already imports `purgeProject`)
- Test: `src/app/core/services/project-io.service.spec.ts`

**Interfaces:**

- Produces: `importProject(…, { kind: 'replace', targetProjectId })` → purges target content first, imports remapped content under the same `projectId`, replaces name/dates from the archive. Atomic via the existing single transaction.

- [ ] **Step 1: Write the failing tests**

Append to `src/app/core/services/project-io.service.spec.ts` :

```ts
it('replaces an existing project, keeping its id and dropping its old content', async () => {
  const { archive } = await importFresh();
  const targetId = 'target-1';
  await db.projects.add({
    id: targetId,
    name: 'Old Project',
    createdAt: 1,
    updatedAt: 2,
    palette: ['#000000'],
    tileSize: 8,
    mapWidth: 1,
    mapHeight: 1,
  });
  const oldTile = await db.tiles.add({
    projectId: targetId,
    name: 'OldTile',
    type: 'static',
    spriteIds: [] as number[],
    animationSpeed: 4,
    properties: { blocking: false, interactable: false },
    folderPath: '',
  });
  await db.sessions.add({
    projectId: targetId,
    lastScreen: 'tiles',
    lastSceneId: null,
    lastTileId: oldTile,
    lastSpriteId: null,
  });

  const result = await service.importProject(JSON.stringify(archive), {
    kind: 'replace',
    targetProjectId: targetId,
  });

  expect(result.projectId).toBe(targetId);
  expect(result.kind).toBe('replace');

  const project = await db.projects.get(targetId);
  expect(project?.name).toBe('Heroes');

  const tiles = await db.tiles.where('projectId').equals(targetId).toArray();
  expect(tiles.map((t: Tile) => t.name)).toEqual([
    expect.stringContaining('Ground'),
    expect.stringContaining('Water'),
  ]);
  expect(tiles.some((t: Tile) => t.name === 'OldTile')).toBe(false);

  const sprites = await db.sprites.where('projectId').equals(targetId).toArray();
  expect(sprites.length).toBe(3);
  expect((await db.sessions.where('projectId').equals(targetId).toArray()).length).toBe(0);
  expect((await db.scenes.where('projectId').equals(targetId).toArray())[0].name).toBe('Level 1');
});

it('leaves the replaced project untouched when validation fails', async () => {
  const targetId = 'target-1';
  await db.projects.add({
    id: targetId,
    name: 'Old Project',
    createdAt: 1,
    updatedAt: 2,
    palette: ['#000000'],
    tileSize: 8,
    mapWidth: 1,
    mapHeight: 1,
  });
  await db.tiles.add({
    projectId: targetId,
    name: 'OldTile',
    type: 'static',
    spriteIds: [] as number[],
    animationSpeed: 4,
    properties: { blocking: false, interactable: false },
    folderPath: '',
  });

  const broken = validJsonOverrides({
    scenes: [
      {
        name: 'Level 1',
        folderPath: '',
        width: 10,
        height: 10,
        layers: [
          {
            id: 'l-1',
            name: 'Background',
            visible: true,
            opacity: 1,
            tileData: [[999, -1]],
          },
        ],
      },
    ],
  });

  await expect(
    service.importProject(broken, { kind: 'replace', targetProjectId: targetId }),
  ).rejects.toThrow(ProjectImportError);

  expect((await db.projects.get(targetId))?.name).toBe('Old Project');
  const tiles = await db.tiles.where('projectId').equals(targetId).toArray();
  expect(tiles.map((t: Tile) => t.name)).toEqual(['OldTile']);
});

it('rolls back a replace whose mid-transaction insert fails', async () => {
  const targetId = 'target-1';
  await db.projects.add({
    id: targetId,
    name: 'Old Project',
    createdAt: 1,
    updatedAt: 2,
    palette: ['#000000'],
    tileSize: 8,
    mapWidth: 1,
    mapHeight: 1,
  });
  await db.tiles.add({
    projectId: targetId,
    name: 'OldTile',
    type: 'static',
    spriteIds: [] as number[],
    animationSpeed: 4,
    properties: { blocking: false, interactable: false },
    folderPath: '',
  });

  const { archive } = await importFresh();
  const spy = vi.spyOn(db.sprites, 'add').mockRejectedValueOnce(new Error('boom'));

  await expect(
    service.importProject(JSON.stringify(archive), { kind: 'replace', targetProjectId: targetId }),
  ).rejects.toThrow('boom');

  spy.mockRestore();
  expect((await db.projects.get(targetId))?.name).toBe('Old Project');
  const tiles = await db.tiles.where('projectId').equals(targetId).toArray();
  expect(tiles.map((t: Tile) => t.name)).toEqual(['OldTile']);
});
```

Note: `importFresh()` clears the DB at the end of its run; the tests above then re-seed a target project afterwards — that's fine. To avoid re-clearing complexities, call `importFresh()` BEFORE seeding the target in each test (as written).

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npx ng test --watch=false --include='src/app/core/services/project-io.service.spec.ts'`
Expected: at least the first replace test FAILS (currently `{kind:'replace'}` would use `targetProjectId` and reuse code path that expects fresh, but nothing purges — old content remains → assertions fail).

- [ ] **Step 3: Ensure the implementation supports replace**

The `importProject` from Task 3 already handles `mode.kind === 'replace'` (uses `targetProjectId`, calls `purgeProject` first, is inside one transaction). No code change should be required. If any assertion reveals a gap (e.g. sessions purge), fix inline, but the expected state is: implementation already correct.

- [ ] **Step 4: Run tests to verify they pass**

Run: `devbox run npx ng test --watch=false --include='src/app/core/services/project-io.service.spec.ts'`
Expected: all PASS (replace happy path + validation-rollback + mid-transaction-rollback).

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/project-io.service.spec.ts
git commit -m "feature-2: cover replace import and transaction rollback safety"
```

## Task 6: Project card export button

**Files:**

- Modify: `src/app/features/dashboard/project-card.component.ts`
- Modify: `src/app/features/dashboard/project-card.component.html`
- Test: `src/app/features/dashboard/project-card.component.spec.ts`

**Interfaces:**

- Consumes: `ProjectIoService.exportProject(projectId)` (Task 2), `NotificationService.error(message)`.
- Produces: `ProjectCardComponent.onExport(event: Event): Promise<void>` (injects `ProjectIoService`, calls `exportProject`, downloads a `river-king-<slug>.rkproj` Blob, notification on failure). Template gains an Export button (`title="Export"`, `aria-label="Export project"`).

- [ ] **Step 1: Write the failing test**

Append to `src/app/features/dashboard/project-card.component.spec.ts` :

```ts
import { ProjectIoService } from '../../core/services/project-io.service';
import { NotificationService } from '../../core/services/notification.service';
```

and inside `describe('ProjectCardComponent', () => { … })`:

```ts
it('exports the project as a downloadable rkproj file', async () => {
  const projectIo = TestBed.inject(ProjectIoService);
  const exportSpy = vi
    .spyOn(projectIo, 'exportProject')
    .mockResolvedValue('{"format":"river-king-project"}');

  const createObjectURL = vi.fn(() => 'blob:mock-url');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');
  try {
    const fixture = TestBed.createComponent(ProjectCardComponent);
    fixture.componentRef.setInput(
      'project',
      createMockProject({ id: 'project-42', name: 'My Hero Game' }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const exportButton = compiled.querySelector<HTMLButtonElement>('button[title="Export"]');
    expect(exportButton).toBeTruthy();
    expect(exportButton!.getAttribute('aria-label')).toBe('Export project');

    exportButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));

    expect(exportSpy).toHaveBeenCalledWith('project-42');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchors = document.body.querySelectorAll('a');
    const lastAnchor = anchors[anchors.length - 1] as HTMLAnchorElement;
    expect(lastAnchor.getAttribute('download')).toBe('river-king-my-hero-game.rkproj');
  } finally {
    vi.unstubAllGlobals();
  }
});

it('notifies the user when the export fails', async () => {
  const projectIo = TestBed.inject(ProjectIoService);
  vi.spyOn(projectIo, 'exportProject').mockRejectedValue(new Error('boom'));
  const notification = TestBed.inject(NotificationService);
  const errorSpy = vi.spyOn(notification, 'error');

  const fixture = TestBed.createComponent(ProjectCardComponent);
  fixture.componentRef.setInput('project', createMockProject({ id: 'project-1' }));
  await fixture.whenStable();
  fixture.detectChanges();

  const compiled = fixture.nativeElement as HTMLElement;
  const exportButton = compiled.querySelector<HTMLButtonElement>('button[title="Export"]');
  exportButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));

  expect(errorSpy).toHaveBeenCalledWith('Failed to export project');
});
```

Note: the existing spec clears DB tables in `beforeEach` — `TestBed.inject(ProjectIoService)` and `NotificationService` are provided by root, fine. `vi.stubGlobal('URL', …)` covers the global; the component calls `URL.createObjectURL` directly.

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npx ng test --watch=false --include='src/app/features/dashboard/project-card.component.spec.ts'`
Expected: FAIL — no `button[title="Export"]`, plus module-level stubs not yet present.

- [ ] **Step 3: Implement the export button**

`src/app/features/dashboard/project-card.component.ts` — add imports and members:

```ts
import { Component, inject, input, output, ChangeDetectionStrategy } from '@angular/core';
import type { Project } from '../../shared/models/project.model';
import { ProjectIoService } from '../../core/services/project-io.service';
import { NotificationService } from '../../core/services/notification.service';
```

Add to the class (class JSDoc already exists; extend it with the export duty):

```ts
  private readonly projectIo = inject(ProjectIoService);
  private readonly notification = inject(NotificationService);

  /**
   * Exports the project to a downloadable `.rkproj` file without opening it.
   * @param event - DOM click event, stopped so it does not bubble to the card root.
   */
  async onExport(event: Event): Promise<void> {
    event.stopPropagation();
    const project = this.project();
    try {
      const json = await this.projectIo.exportProject(project.id);
      this.download(json, project.name);
    } catch (error) {
      console.error('Failed to export project:', error);
      this.notification.error('Failed to export project');
    }
  }

  /**
   * Triggers a browser download of the archive JSON.
   * @param json - The archive serialization.
   * @param name - Project name used for the file slug.
   */
  private download(json: string, name: string): void {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `river-king-${this.slugify(name)}.rkproj`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * Lowercases a name and collapses non-alphanumeric runs into dashes.
   * @param name - Raw name.
   * @returns URL-safe slug, never empty.
   */
  private slugify(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'project';
  }
```

`src/app/features/dashboard/project-card.component.html` — add the Export button next to the delete button (inside the `<div class="tw-flex tw-items-start tw-justify-between …">`):

```html
<button
  type="button"
  (click)="onExport($event)"
  (keydown)="$event.stopPropagation()"
  title="Export"
  aria-label="Export project"
  class="tw-p-1 tw-rounded-sm tw-opacity-0 group-hover:tw-opacity-100 focus-visible:tw-opacity-100 tw-text-muted-foreground hover:tw-bg-accent/10 tw-transition"
>
  <span class="material-symbols tw-text-sm" aria-hidden="true">download</span>
</button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devbox run npx ng test --watch=false --include='src/app/features/dashboard/project-card.component.spec.ts'`
Expected: all PASS (existing 10 + export success + export failure).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/dashboard/project-card.component.ts src/app/features/dashboard/project-card.component.html src/app/features/dashboard/project-card.component.spec.ts
git commit -m "feature-2: add export button to project cards"
```

## Task 7: Import project dialog

**Files:**

- Create: `src/app/features/dashboard/import-project-dialog/import-project-dialog.component.ts`
- Create: `src/app/features/dashboard/import-project-dialog/import-project-dialog.component.html`
- Create: `src/app/features/dashboard/import-project-dialog/import-project-dialog.component.scss`
- Test: `src/app/features/dashboard/import-project-dialog/import-project-dialog.component.spec.ts`

**Interfaces:**

- Consumes: `ProjectArchive` (Task 1), `Project` (`shared/models/project.model`), `ImportMode` (Task 2), `DialogComponent`.
- Produces: `ImportProjectDialogComponent` with inputs `archive: input<ProjectArchive | null>(null)`, `projects: input<Project[]>([])`, outputs `confirmed: output<ImportMode>()`, `cancelled: output<void>()`, and public `open(): void`. Summary computed: tile count, frame count, scene count, palette count. Selector `rk-import-project-dialog`. `canConfirm` computed: true when `replaceMode()? selectedProjectId() is one of projects() : archive() != null`.

- [ ] **Step 1: Write the failing test**

Create `src/app/features/dashboard/import-project-dialog/import-project-dialog.component.spec.ts` :

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Vi as Vitest } from 'vitest';
import { By } from '@angular/platform-browser';
import { ImportProjectDialogComponent } from './import-project-dialog.component';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import type { ProjectArchive } from '../../../shared/models/project-archive.model';
import type { Project } from '../../../shared/models/project.model';

// jsdom does not implement HTMLDialogElement methods
const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
if (typeof dialogProto['showModal'] !== 'function') {
  dialogProto['showModal'] = function () {
    // no-op
  };
}
if (typeof dialogProto['close'] !== 'function') {
  dialogProto['close'] = function (returnValue?: string) {
    (this as unknown as HTMLDialogElement).returnValue = returnValue ?? '';
    (this as unknown as HTMLDialogElement).dispatchEvent(new Event('close'));
  };
}

function makeArchive(): ProjectArchive {
  return {
    format: 'river-king-project',
    formatVersion: 1,
    exportedAt: 0,
    project: {
      name: 'Heroes',
      palette: ['#ff0000', '#00ff00'],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    },
    tiles: [
      {
        sourceId: 1,
        name: 'Ground',
        type: 'static',
        spriteIds: [11],
        animationSpeed: 4,
        properties: { blocking: false, interactable: false },
        folderPath: '',
      },
      {
        sourceId: 2,
        name: 'Water',
        type: 'animated',
        spriteIds: [12, 13],
        animationSpeed: 8,
        properties: { blocking: true, interactable: true },
        folderPath: 'nature',
      },
    ],
    sprites: [
      { sourceId: 11, tileSourceId: 1, name: 'f1', width: 16, height: 16, pixelData: 'a' },
      { sourceId: 12, tileSourceId: 2, name: 'f2', width: 16, height: 16, pixelData: 'b' },
      { sourceId: 13, tileSourceId: 2, name: 'f3', width: 16, height: 16, pixelData: 'c' },
    ],
    scenes: [
      {
        name: 'Level 1',
        folderPath: '',
        width: 10,
        height: 10,
        layers: [{ id: 'l1', name: 'B', visible: true, opacity: 1, tileData: [[1]] }],
      },
    ],
    folders: ['nature'],
  };
}

function makeProject(id: string, name: string): Project {
  return {
    id,
    name,
    createdAt: 0,
    updatedAt: 0,
    palette: ['#000000'],
    tileSize: 16,
    mapWidth: 40,
    mapHeight: 30,
  };
}

describe('ImportProjectDialogComponent', () => {
  let fixture: ComponentFixture<ImportProjectDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportProjectDialogComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ImportProjectDialogComponent);
    fixture.componentRef.setInput('archive', makeArchive());
    fixture.componentRef.setInput('projects', [
      makeProject('p1', 'Alpha'),
      makeProject('p2', 'Beta'),
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.componentInstance.open();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function buttons() {
    return fixture.nativeElement.querySelectorAll('button');
  }

  it('renders the imported project name and a content summary', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Heroes');
    expect(text).toContain('2 tiles');
    expect(text).toContain('3 frames');
    expect(text).toContain('1 scenes');
    expect(text).toContain('2-color palette');
  });

  it('defaults to create-as-new and emits a new mode on confirm', () => {
    const spy = vi.fn();
    fixture.componentInstance.confirmed.subscribe(spy);
    const importedBtn = [...buttons()].find((b) => b.textContent?.includes('Import'));
    importedBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(spy).toHaveBeenCalledWith({ kind: 'new' });
  });

  it('emits a replace mode with the chosen target project', () => {
    const spy = vi.fn();
    fixture.componentInstance.confirmed.subscribe(spy);

    const select = fixture.nativeElement.querySelector(
      'select[aria-label="Project to replace"]',
    ) as HTMLSelectElement;
    select.value = 'p2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const replaceRadio = [...buttons()].find((b) =>
      b.textContent?.includes('Replace an existing project'),
    )!;
    replaceRadio.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    const importedBtn = [...buttons()].find((b) => b.textContent?.includes('Import'));
    importedBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(spy).toHaveBeenCalledWith({ kind: 'replace', targetProjectId: 'p2' });
  });

  it('disables confirm when replace mode has no target selected', () => {
    const replaceRadio = [...buttons()].find((b) =>
      b.textContent?.includes('Replace an existing project'),
    )!;
    replaceRadio.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    const importedBtn = [...buttons()].find((b) =>
      b.textContent?.includes('Import'),
    ) as HTMLButtonElement;
    expect(importedBtn.disabled).toBe(true);
  });

  it('does not emit confirmed when cancelled', () => {
    const spy = vi.fn();
    fixture.componentInstance.confirmed.subscribe(spy);
    const cancelBtn = [...buttons()].find((b) => b.textContent?.trim() === 'Cancel')!;
    cancelBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(spy).not.toHaveBeenCalled();
  });
});
```

Note: the flow for the "replace" test clicks select **then** radio; the `canConfirm` computed needs `selectedProjectId` in `projects` and `replaceMode` true. Selecting first then switching mode is fine because `canConfirm` is derived. If the component's `open()` resets state, the `beforeEach` already called `open()`. One fix: order the radio click first in tests that combine both (the spec must match the code path — adjust as needed so upstream/derived state is consistent).

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npx ng test --watch=false --include='src/app/features/dashboard/import-project-dialog/import-project-dialog.component.spec.ts'`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the dialog**

`src/app/features/dashboard/import-project-dialog/import-project-dialog.component.ts` :

```ts
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import type { Project } from '../../../shared/models/project.model';
import type { ProjectArchive } from '../../../shared/models/project-archive.model';
import type { ImportMode } from '../../../core/services/project-io.service';

/**
 * Modal dialog confirming how an imported `.rkproj` archive should be applied:
 * as a brand-new project or as a replacement of an existing one.
 */
@Component({
  selector: 'rk-import-project-dialog',
  standalone: true,
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './import-project-dialog.component.html',
  styleUrl: './import-project-dialog.component.scss',
})
export class ImportProjectDialogComponent {
  private readonly dialogRef = viewChild.required(DialogComponent);

  /**
   * Validated archive about to be imported, or null while none is pending.
   */
  archive = input<ProjectArchive | null>(null);

  /**
   * Existing projects offered as replacement targets.
   */
  projects = input<Project[]>([]);

  /**
   * Emitted with the chosen import mode when the user confirms.
   */
  confirmed = output<ImportMode>();

  /**
   * Emitted whenever the dialog closes without confirming an import.
   */
  cancelled = output<void>();

  /** True while the user wants to overwrite an existing project. */
  readonly replaceMode = signal(false);

  /** Id of the project selected for replacement. */
  readonly selectedProjectId = signal<string | null>(null);

  /** Number of tiles carried by the archive. */
  readonly tileCount = computed(() => this.archive()?.tiles.length ?? 0);

  /** Total frames (sum of tile spriteIds) carried by the archive. */
  readonly frameCount = computed(() =>
    (this.archive()?.tiles ?? []).reduce((sum, t) => sum + t.spriteIds.length, 0),
  );

  /** Number of scenes carried by the archive. */
  readonly sceneCount = computed(() => this.archive()?.scenes.length ?? 0);

  /** Number of palette colors carried by the archive. */
  readonly paletteCount = computed(() => this.archive()?.project.palette.length ?? 0);

  /** True when the confirm button may be used. */
  readonly canConfirm = computed(
    () =>
      this.archive() !== null &&
      (!this.replaceMode() ||
        (this.selectedProjectId() !== null &&
          this.projects().some((p) => p.id === this.selectedProjectId()))),
  );

  /**
   * Opens the dialog and resets the mode choices to their defaults.
   */
  open(): void {
    this.replaceMode.set(false);
    this.selectedProjectId.set(null);
    this.dialogRef().open();
  }

  /** Switches the import mode to create a new project. */
  chooseNew(): void {
    this.replaceMode.set(false);
  }

  /** Switches the import mode to replace an existing project. */
  chooseReplace(): void {
    this.replaceMode.set(true);
  }

  /**
   * Records the replacement target chosen in the select.
   * @param event - Change event from the select element.
   */
  onSelectChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedProjectId.set(value || null);
  }

  /**
   * Emits the chosen import mode when the confirm button is used.
   */
  confirm(): void {
    if (!this.canConfirm()) return;
    const mode: ImportMode = this.replaceMode()
      ? { kind: 'replace', targetProjectId: this.selectedProjectId() as string }
      : { kind: 'new' };
    this.confirmed.emit(mode);
  }

  /** Closes the dialog without importing. */
  cancel(): void {
    this.dialogRef().close();
  }

  /** Fires cancelled when the dialog reports a close. */
  onDialogClosed(): void {
    this.cancelled.emit();
  }
}
```

`src/app/features/dashboard/import-project-dialog/import-project-dialog.component.html` :

```html
<rk-dialog #dialog (closed)="onDialogClosed()">
  <div class="tw-p-6">
    <h2 class="tw-text-xl tw-font-bold tw-mb-2">Import Project</h2>
    <p class="tw-text-sm tw-mb-4">
      Your project “<strong>{{ archive()?.project.name }}</strong>” contains
      <strong>{{ tileCount() }}</strong> tiles, <strong>{{ frameCount() }}</strong> frames,
      <strong>{{ sceneCount() }}</strong> scenes and a
      <strong>{{ paletteCount() }}-color palette</strong>.
    </p>
    <div class="tw-flex tw-flex-col tw-gap-3 tw-mb-4">
      <div class="tw-flex tw-items-center tw-gap-2">
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="!replaceMode()"
          (click)="chooseNew()"
          class="tw-px-3 tw-py-2 tw-rounded-sm tw-border tw-border-border tw-text-sm tw-text-left tw-cursor-pointer hover:tw-bg-muted"
          [class.tw-bg-muted]="!replaceMode()"
          [class.tw-border-accent]="!replaceMode()"
        >
          Create a new project
        </button>
      </div>
      <div class="tw-flex tw-items-center tw-gap-2">
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="replaceMode()"
          (click)="chooseReplace()"
          class="tw-px-3 tw-py-2 tw-rounded-sm tw-border tw-border-border tw-text-sm tw-text-left tw-cursor-pointer hover:tw-bg-muted"
          [class.tw-bg-muted]="replaceMode()"
          [class.tw-border-accent]="replaceMode()"
        >
          Replace an existing project
        </button>
        <select
          aria-label="Project to replace"
          [disabled]="!replaceMode()"
          [value]="selectedProjectId() ?? ''"
          (change)="onSelectChange($event)"
          class="tw-px-3 tw-py-2 tw-rounded-sm tw-border tw-border-input tw-bg-background tw-text-foreground tw-text-sm"
        >
          <option value="">Select a project…</option>
          @for (p of projects(); track p.id) {
          <option [value]="p.id">{{ p.name }}</option>
          }
        </select>
      </div>
    </div>
    <div class="tw-flex tw-justify-end tw-gap-2">
      <button
        type="button"
        (click)="cancel()"
        class="tw-px-4 tw-py-2 tw-rounded-sm tw-border tw-border-border tw-bg-background tw-text-foreground hover:tw-bg-muted"
      >
        Cancel
      </button>
      <button
        type="button"
        [disabled]="!canConfirm()"
        (click)="confirm()"
        class="tw-px-4 tw-py-2 tw-rounded-sm tw-bg-primary tw-text-primary-foreground hover:tw-opacity-90 disabled:tw-opacity-50"
      >
        Import
      </button>
    </div>
  </div>
</rk-dialog>
```

`src/app/features/dashboard/import-project-dialog/import-project-dialog.component.scss` : optional; an empty file is acceptable (`app/styles` handle tokens). Keep only tokens if any styling beyond utilities is needed — for now leave a minimal placeholder comment-only file.

- [ ] **Step 4: Run test to verify it passes**

Run: `devbox run npx ng test --watch=false --include='src/app/features/dashboard/import-project-dialog/import-project-dialog.component.spec.ts'`
Expected: all 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/dashboard/import-project-dialog/
git commit -m "feature-2: add import project dialog (new vs replace)"
```

## Task 8: Dashboard wiring (Import button, file picker, orchestration)

**Files:**

- Modify: `src/app/features/dashboard/dashboard.component.ts`
- Modify: `src/app/features/dashboard/dashboard.component.html`
- Test: `src/app/features/dashboard/dashboard.component.spec.ts`

**Interfaces:**

- Consumes: `ImportProjectDialogComponent` (Task 7), `ProjectIoService` (`importProject`, `parsePreview`), `ProjectImportError`, `NotificationService`, `ElementRef`/`viewChild` for the hidden file input.
- Produces: `DashboardComponent` gains `openImportPicker(): void`, `onFileSelected(event: Event): Promise<void>`, `importProjectFromFile(mode: ImportMode): Promise<void>`, `clearPendingImport(): void`; signal `pendingImport`. Template gains an Import button + hidden file input + the `rk-import-project-dialog`.

- [ ] **Step 1: Write the failing tests**

Append to `src/app/features/dashboard/dashboard.component.spec.ts` :

```ts
import { ImportProjectDialogComponent } from './import-project-dialog/import-project-dialog.component';
import { ProjectIoService, ProjectImportError } from '../../core/services/project-io.service';
import { NotificationService } from '../../core/services/notification.service';
```

Inside the describe:

```ts
const minimalArchiveJson = JSON.stringify({
  format: 'river-king-project',
  formatVersion: 1,
  exportedAt: 0,
  project: { name: 'Imported', palette: ['#000000'], tileSize: 16, mapWidth: 40, mapHeight: 30 },
  tiles: [],
  sprites: [],
  scenes: [],
  folders: [],
});

function selectFile(compiled: HTMLElement, content: string, name = 'proj.rkproj'): void {
  const input = compiled.querySelector<HTMLInputElement>('input[type="file"]');
  const file = new File([content], name, { type: 'application/json' });
  Object.defineProperty(input!, 'files', { value: [file], configurable: true });
  input!.dispatchEvent(new Event('change'));
}

it('renders an import button in the header', async () => {
  await mountWithProjects([]);
  const compiled = fixture.nativeElement as HTMLElement;
  const importButton = compiled.querySelector<HTMLElement>('[data-testid="import-project"]');
  expect(importButton).toBeTruthy();
  expect(compiled.textContent).toContain('Import');
});

it('opens the import dialog for a valid file', async () => {
  await mountWithProjects([]);
  const dialog = fixture.debugElement.query(By.directive(ImportProjectDialogComponent))
    .componentInstance as ImportProjectDialogComponent;
  const openSpy = vi.spyOn(dialog, 'open');

  selectFile(fixture.nativeElement as HTMLElement, minimalArchiveJson);
  await new Promise((r) => setTimeout(r, 50));
  fixture.detectChanges();

  expect(openSpy).toHaveBeenCalledTimes(1);
  expect(fixture.componentInstance.pendingImport()).not.toBeNull();
});

it('shows an error notification for an invalid file', async () => {
  await mountWithProjects([]);
  const notification = TestBed.inject(NotificationService);
  const errorSpy = vi.spyOn(notification, 'error');
  const dialogOpenSpy = (() => {
    const dialog = fixture.debugElement.query(By.directive(ImportProjectDialogComponent))
      .componentInstance as ImportProjectDialogComponent;
    return vi.spyOn(dialog, 'open');
  })();

  selectFile(fixture.nativeElement as HTMLElement, '{not json');
  await new Promise((r) => setTimeout(r, 50));

  expect(errorSpy).toHaveBeenCalledWith('This file is not a valid project file.');
  expect(dialogOpenSpy).not.toHaveBeenCalled();
});

it('runs the import on confirm and navigates to the new project', async () => {
  await mountWithProjects([]);
  const projectIo = TestBed.inject(ProjectIoService);
  const importSpy = vi
    .spyOn(projectIo, 'importProject')
    .mockResolvedValue({ projectId: 'fresh-1', kind: 'new' });
  const successSpy = vi.spyOn(TestBed.inject(NotificationService), 'success');
  const navigateSpy = vi.spyOn(fixture.componentInstance['router'], 'navigate');
  navigateSpy.mockResolvedValue(true);

  selectFile(fixture.nativeElement as HTMLElement, minimalArchiveJson);
  await new Promise((r) => setTimeout(r, 50));
  fixture.detectChanges();
  await fixture.componentInstance.importProjectFromFile({ kind: 'new' });
  await new Promise((r) => setTimeout(r, 50));

  expect(importSpy).toHaveBeenCalledWith(minimalArchiveJson, { kind: 'new' });
  expect(successSpy).toHaveBeenCalledWith('Project imported');
  expect(navigateSpy).toHaveBeenCalledWith(['/project', 'fresh-1']);
  expect(fixture.componentInstance.pendingImport()).toBeNull();
});
```

Note: accessing `fixture.componentInstance['router']` is brittle (private field). Prefer asserting navigation indirectly: mock `Router` provider — simpler to spy via `TestBed.inject(Router)`: since the component injected the same root router instance, `vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true)` and assert on it. Use that form instead.

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npx ng test --watch=false --include='src/app/features/dashboard/dashboard.component.spec.ts'`
Expected: FAIL — `data-testid="import-project"` missing, `importProjectFromFile` undefined.

- [ ] **Step 3: Implement dashboard wiring**

`src/app/features/dashboard/dashboard.component.ts` — extend imports and class:

```ts
import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  viewChild,
  effect,
  ElementRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { ProjectService } from './services/project.service';
import { StatusBarService } from '../../core/services/status-bar.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  ProjectIoService,
  ProjectImportError,
  type ImportMode,
} from '../../core/services/project-io.service';
import type { Project } from '../../shared/models/project.model';
import type { ProjectArchive } from '../../shared/models/project-archive.model';
import { ProjectCardComponent } from './project-card.component';
import { ProjectCreateDialogComponent } from './project-create-dialog.component';
import { ImportProjectDialogComponent } from './import-project-dialog/import-project-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
```

Add members:

```ts
  private readonly projectIo = inject(ProjectIoService);
  private readonly notification = inject(NotificationService);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  /** Template reference to the import dialog component. */
  importDialog = viewChild.required(ImportProjectDialogComponent);

  /** Pending validated archive read from a selected file, or null. */
  pendingImport = signal<{ text: string; archive: ProjectArchive } | null>(null);
```

Constructor — add the third effect:

```ts
effect(() => {
  if (this.pendingImport()) {
    this.importDialog().open();
  }
});
```

Add methods (JSDoc required):

```ts
  /** Opens the hidden file picker for a project archive. */
  openImportPicker(): void {
    this.fileInput().nativeElement.click();
  }

  /**
   * Reads a selected archive file, validates it, and stages it for import.
   * @param event - Change event from the file input.
   */
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const archive = this.projectIo.parsePreview(text);
      this.pendingImport.set({ text, archive });
    } catch (error) {
      if (error instanceof ProjectImportError) {
        this.notification.error(error.message);
      } else {
        console.error('Failed to read project file:', error);
        this.notification.error('Failed to read the file');
      }
    } finally {
      input.value = '';
    }
  }

  /**
   * Applies the staged archive using the chosen import mode.
   * @param mode - Whether to create a new project or replace an existing one.
   */
  async importProjectFromFile(mode: ImportMode): Promise<void> {
    const pending = this.pendingImport();
    if (!pending) return;
    try {
      const { projectId } = await this.projectIo.importProject(pending.text, mode);
      this.pendingImport.set(null);
      this.importDialog().close();
      this.notification.success('Project imported');
      await this.loadProjects();
      await this.router.navigate(['/project', projectId]);
    } catch (error) {
      if (error instanceof ProjectImportError) {
        this.notification.error(error.message);
      } else {
        console.error('Failed to import project:', error);
        this.notification.error('Failed to import project');
      }
    }
  }

  /** Clears the staged import when the dialog is dismissed. */
  clearPendingImport(): void {
    this.pendingImport.set(null);
  }
```

`src/app/features/dashboard/dashboard.component.html` — header buttons become a group, add the hidden input, and mount the dialog:

```html
<header class="tw-flex tw-items-center tw-justify-between tw-px-4 tw-py-3">
  <h1
    data-testid="dashboard-title"
    class="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-muted-foreground"
  >
    My Projects
  </h1>
  <div class="tw-flex tw-items-center tw-gap-2">
    <button
      type="button"
      data-testid="import-project"
      (click)="openImportPicker()"
      class="tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-sm tw-border tw-border-border tw-bg-background tw-text-xs tw-text-foreground hover:tw-bg-muted tw-transition"
    >
      <span class="material-symbols tw-text-sm" aria-hidden="true">upload_file</span>
      Import
    </button>
    <button
      type="button"
      (click)="createDialog.open()"
      class="tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-sm tw-bg-primary tw-text-primary-foreground tw-text-xs tw-transition hover:tw-opacity-90"
    >
      <span class="material-symbols tw-text-sm" aria-hidden="true">add</span>
      New Project
    </button>
    <input
      #fileInput
      type="file"
      accept=".rkproj,application/json"
      class="tw-hidden"
      (change)="onFileSelected($event)"
    />
  </div>
</header>
```

And before the closing `</div>` (after the `rk-confirm-dialog`) add:

```html
<rk-import-project-dialog
  #importDialog
  [archive]="pendingImport()?.archive ?? null"
  [projects]="projects()"
  (confirmed)="importProjectFromFile($event)"
  (cancelled)="clearPendingImport()"
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devbox run npx ng test --watch=false --include='src/app/features/dashboard/dashboard.component.spec.ts'`
Expected: all PASS (existing 6 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/dashboard/dashboard.component.ts src/app/features/dashboard/dashboard.component.html src/app/features/dashboard/dashboard.component.spec.ts
git commit -m "feature-2: wire import flow into the dashboard"
```

## Task 9: Global verification + final commit

**Files:**

- All of the above.

**Interfaces:**

- Produces: a green feature branch ready for PR.

- [ ] **Step 1: Run all new unit suites**

Run:

```
devbox run npx ng test --watch=false --include='src/app/shared/models/project-archive.model.spec.ts'
devbox run npx ng test --watch=false --include='src/app/core/services/project-io.service.spec.ts'
devbox run npx ng test --watch=false --include='src/app/features/dashboard/project-card.component.spec.ts'
devbox run npx ng test --watch=false --include='src/app/features/dashboard/import-project-dialog/import-project-dialog.component.spec.ts'
devbox run npx ng test --watch=false --include='src/app/features/dashboard/dashboard.component.spec.ts'
```

Expected: each suite green. (Run them individually; `--include` takes one file.)

- [ ] **Step 2: Run the full test suite**

Run: `devbox run npm run test`
Expected: all pass EXCEPT the known pre-existing `project-create-dialog.component.spec.ts > highlights exactly the selected palette row` failure (out of scope). Total count should equal previous 287 + new tests (≈ 287 + 6 + 15 + 2 + 5 + 4 = 319 but confirm the exact count from output; no other failures).

- [ ] **Step 3: Lint + build**

Run: `devbox run npm run lint` then `devbox run npm run build`
Expected: `All files pass linting` ; bundle completes.

- [ ] **Step 4: Re-run the affected suites once more for stability**

Run the five new suites again (Step 1). If any test fails only on a second run, diagnose via fixing sync/async flush (add `await new Promise(r => setTimeout(r, 50))` where a Dexie write is still settling) — do not silence with longer sleeps blindly.

- [ ] **Step 5: Commit any verification fallout**

If Step 4 produced fixes, commit them:

```bash
git add -A
git commit -m "feature-2: stabilize export/import tests"
```

Otherwise, nothing to commit.

- [ ] **Step 6: Final commit check + push**

Run: `git status --short` — expect only the spec + plan docs uncommitted (checked in Task-less docs flow) or nothing.

Push the branch:

```bash
git push -u origin feature-2
```

## Self-Review Notes

- **Spec coverage:** export (Task 2), import new+replace+rollback (Tasks 3/5), validation strictes (Task 4), UI cartes/header/dialog (Tasks 6-8), atomicity (Task 3), lossless base64 (Task 2 e.g. `pixelData` byte-equal), exclusion Session (asserted in Task 3), nom d'archive en replace (Task 5), formats constants (Task 1). ✓
- **Placeholders:** none — every step carries code + expected output.
- **Type consistency:** `ProjectArchive`, `ImportMode`, `ImportResult`, `ProjectImportError`, `exportProject`, `parsePreview`, `importProject`, `openImportPicker`, `onFileSelected`, `importProjectFromFile`, `clearPendingImport` names identical across tasks.
