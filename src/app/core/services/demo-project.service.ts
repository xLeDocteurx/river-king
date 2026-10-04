import { Injectable, inject } from '@angular/core';
import type { Project } from '../../shared/models/project.model';
import type { Scene } from '../../shared/models/scene.model';
import type { Tile } from '../../shared/models/tile.model';
import type { Sprite } from '../../shared/models/sprite.model';
import { DatabaseService } from './database.service';
import { NotificationService } from './notification.service';
import { LOSPEC_PALETTES } from '../palettes/lospec-palettes';
import { encodePixelData } from '../../shared/utils/pixel-data';
import { DEMO_ACTION_ID } from '../actions/game-actions';
import {
  DEMO_PROJECT_NAME,
  DEMO_SCENE_NAME,
  DEMO_PALETTE_ID,
  DEMO_WIDTH,
  DEMO_HEIGHT,
  DEMO_TILE_SIZE,
  POND,
  TREE_ROW_Y,
  TREE_ROW_START_X,
  TREE_ROW_STEP_X,
  TREE_ROW_END_X,
  BOULDER_CELL,
  SIGN_CELL,
  grassIndices,
  waterIndices,
  trunkIndices,
  foliageIndices,
  boulderIndices,
  signIndices,
} from './demo-art';

/** localStorage key recording that first-run seeding has already been attempted. */
export const DEMO_SEED_MARKER = 'rk-demo-seeded';

/**
 * Seeds a single « Demo » showcase project on the first run of an empty
 * database. Runs once per browser: the marker is set whether the seed ran
 * (empty DB) or the base was already populated, so deleting the demo later
 * never resurrects it. Writes happen inside one atomic Dexie transaction.
 */
@Injectable({ providedIn: 'root' })
export class DemoProjectService {
  private readonly db = inject(DatabaseService);
  private readonly notify = inject(NotificationService);
  private inFlight = false;

  /**
   * Seeds the demo project when this is the browser's first run over an
   * empty database, then stores the marker. Failure leaves the marker unset
   * so the next session retries, and surfaces a toast.
   * @returns Whether this call created the demo project.
   */
  async ensureDemo(): Promise<boolean> {
    if (localStorage.getItem(DEMO_SEED_MARKER)) return false;
    if (this.inFlight) return false;
    this.inFlight = true;
    let seeded = false;
    try {
      const count = await this.db.projects.count();
      if (count === 0) {
        await this.seed();
        seeded = true;
      }
      localStorage.setItem(DEMO_SEED_MARKER, 'true');
    } catch {
      this.notify.error('Failed to set up the demo project');
    } finally {
      this.inFlight = false;
    }
    return seeded;
  }

  /**
   * Creates the demo project, scene, sprites, and tiles in one transaction.
   * Tiles are inserted first with empty `spriteIds`, sprites then reference
   * their owning tile, and tiles are patched with their frame lists.
   * @throws When any table write or the palette lookup fails.
   */
  private async seed(): Promise<void> {
    const found = LOSPEC_PALETTES.find((p) => p.id === DEMO_PALETTE_ID);
    if (!found) {
      throw new Error(`Missing palette ${DEMO_PALETTE_ID}`);
    }
    const palette = found.colors.map((c) => `#${c}`);
    const now = Date.now();

    await this.db.transaction(
      'rw',
      this.db.projects,
      this.db.scenes,
      this.db.sprites,
      this.db.tiles,
      async () => {
        const projectId = await this.db.projects.add({
          id: crypto.randomUUID(),
          name: DEMO_PROJECT_NAME,
          createdAt: now,
          updatedAt: now,
          palette,
          tileSize: DEMO_TILE_SIZE,
          mapWidth: DEMO_WIDTH,
          mapHeight: DEMO_HEIGHT,
        } satisfies Project);

        const frame = (name: string) =>
          ({
            projectId,
            type: 'static',
            spriteIds: [] as number[],
            animationSpeed: 4,
            properties: { blocking: false, interactable: false, ySort: false },
            folderPath: '',
            name,
          }) as Tile;

        const grassTileId = await this.db.tiles.add(frame('Grass'));
        const waterTileId = await this.db.tiles.add({
          ...frame('Water'),
          type: 'animated',
          properties: { blocking: true, interactable: false, ySort: false },
        });
        const treeTileId = await this.db.tiles.add({
          ...frame('Tree'),
          properties: { blocking: true, interactable: false, ySort: true },
        });
        const boulderTileId = await this.db.tiles.add({
          ...frame('Boulder'),
          properties: { blocking: true, interactable: false, ySort: false },
        });
        const signTileId = await this.db.tiles.add({
          ...frame('Sign'),
          properties: {
            blocking: false,
            interactable: true,
            ySort: false,
            actionId: DEMO_ACTION_ID,
          },
        });

        const sprite = (tileId: number, name: string, indices: number[][]): Sprite =>
          ({
            projectId,
            tileId,
            name,
            width: DEMO_TILE_SIZE,
            height: DEMO_TILE_SIZE,
            pixelData: encodePixelData(indices, palette),
            paletteIndices: indices,
          }) as Sprite;

        const grassSpriteId = await this.db.sprites.add(
          sprite(grassTileId, 'Grass', grassIndices()),
        );
        const water1Id = await this.db.sprites.add(sprite(waterTileId, 'Water 1', waterIndices(1)));
        const water2Id = await this.db.sprites.add(sprite(waterTileId, 'Water 2', waterIndices(2)));
        const trunkId = await this.db.sprites.add(sprite(treeTileId, 'Trunk', trunkIndices()));
        const foliageId = await this.db.sprites.add(
          sprite(treeTileId, 'Foliage', foliageIndices()),
        );
        const boulderSpriteId = await this.db.sprites.add(
          sprite(boulderTileId, 'Boulder', boulderIndices()),
        );
        const signSpriteId = await this.db.sprites.add(sprite(signTileId, 'Sign', signIndices()));

        await this.db.tiles.update(grassTileId, { spriteIds: [grassSpriteId] });
        await this.db.tiles.update(waterTileId, { spriteIds: [water1Id, water2Id] });
        await this.db.tiles.update(treeTileId, { spriteIds: [trunkId, foliageId] });
        await this.db.tiles.update(boulderTileId, { spriteIds: [boulderSpriteId] });
        await this.db.tiles.update(signTileId, { spriteIds: [signSpriteId] });

        const background = Array.from({ length: DEMO_HEIGHT }, () =>
          Array<number>(DEMO_WIDTH).fill(grassTileId),
        );
        const overhead = Array.from({ length: DEMO_HEIGHT }, () =>
          Array<number>(DEMO_WIDTH).fill(-1),
        );
        for (let y = POND.y; y < POND.y + POND.h; y++) {
          for (let x = POND.x; x < POND.x + POND.w; x++) {
            overhead[y][x] = waterTileId;
          }
        }
        for (let x = TREE_ROW_START_X; x <= TREE_ROW_END_X; x += TREE_ROW_STEP_X) {
          overhead[TREE_ROW_Y][x] = treeTileId;
        }
        overhead[BOULDER_CELL.y][BOULDER_CELL.x] = boulderTileId;
        overhead[SIGN_CELL.y][SIGN_CELL.x] = signTileId;

        const sceneId = crypto.randomUUID();
        await this.db.scenes.add({
          id: sceneId,
          projectId,
          name: DEMO_SCENE_NAME,
          folderPath: '',
          spawnPoint: null,
          width: DEMO_WIDTH,
          height: DEMO_HEIGHT,
          layers: [
            {
              id: crypto.randomUUID(),
              name: 'Background',
              visible: true,
              opacity: 1,
              tileData: background,
            },
            {
              id: crypto.randomUUID(),
              name: 'Overhead',
              visible: true,
              opacity: 1,
              tileData: overhead,
            },
          ],
        } satisfies Scene);
      },
    );
  }
}
