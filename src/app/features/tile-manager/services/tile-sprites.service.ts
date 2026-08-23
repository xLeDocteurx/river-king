import { Injectable, inject, signal } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import { blankIndices, cropOrPadIndices, encodePixelData } from '../../../shared/utils/pixel-data';
import type { Sprite } from '../../../shared/models/sprite.model';

/**
 * Feature-private service managing the sprites linked to a tile:
 * frame listing/creation/deletion and multi-frame resizing.
 *
 * Also owns the reactive frame state shared by the tile manager page:
 * `sprites` holds the frames of the currently loaded tile and
 * `mutationVersion` lets watchers reload dependent data after mutations,
 * removing the need for child-to-parent output chains.
 */
@Injectable()
export class TileSpritesService {
  private readonly db = inject(DatabaseService);

  /** Frames of the tile currently loaded in this service, ordered by id. */
  readonly sprites = signal<Sprite[]>([]);

  /** Counter incremented after each completed mutation cycle. */
  readonly mutationVersion = signal(0);

  /** Id of the tile whose frames are currently loaded (null = none). */
  private currentTileId: number | null = null;

  /**
   * Lists sprites of a tile sorted by creation order (id).
   * @param tileId - The tile whose frames to list.
   * @returns Sprites ordered by ascending id.
   */
  async getTileSprites(tileId: number): Promise<Sprite[]> {
    const sprites = await this.db.sprites.where('tileId').equals(tileId).toArray();
    return sprites.sort((a, b) => a.id - b.id);
  }

  /**
   * Loads the frames of a tile into the reactive {@link sprites} signal.
   * @param tileId - The tile whose frames become the current selection.
   */
  async loadForTile(tileId: number): Promise<void> {
    this.currentTileId = tileId;
    await this.refresh();
  }

  /** Clears the loaded selection (e.g. after the selected tile was deleted). */
  clearSelection(): void {
    this.currentTileId = null;
    this.sprites.set([]);
  }

  /**
   * Refreshes {@link sprites} from the database for the current tile, then
   * increments {@link mutationVersion} so watchers can reload dependent data.
   * Call once after completing a full mutation orchestration (frames + tile sync).
   */
  async markMutated(): Promise<void> {
    await this.refresh();
    this.mutationVersion.update((v) => v + 1);
  }

  /**
   * Reloads {@link sprites} for the current tile id.
   */
  private async refresh(): Promise<void> {
    if (this.currentTileId === null) {
      this.sprites.set([]);
      return;
    }
    this.sprites.set(await this.getTileSprites(this.currentTileId));
  }

  /**
   * Creates a blank fully-transparent frame for a tile.
   * @param projectId - Owning project id.
   * @param tileId - Tile the frame belongs to.
   * @param name - Frame name.
   * @param widthPx - Width in pixels.
   * @param heightPx - Height in pixels.
   * @returns The persisted sprite with its new id.
   */
  async createBlankFrame(
    projectId: string,
    tileId: number,
    name: string,
    widthPx: number,
    heightPx: number,
  ): Promise<Sprite> {
    const sprite: Omit<Sprite, 'id'> = {
      projectId,
      tileId,
      name,
      width: widthPx,
      height: heightPx,
      pixelData: encodePixelData(blankIndices(widthPx, heightPx), []),
      paletteIndices: blankIndices(widthPx, heightPx),
    };
    const id = await this.db.sprites.add(sprite as Sprite);
    return { ...sprite, id };
  }

  /**
   * Deletes the given sprites by id.
   * @param ids - Sprite ids to remove.
   */
  async deleteSprites(ids: number[]): Promise<void> {
    await this.db.sprites.bulkDelete(ids);
  }

  /**
   * Resizes every sprite to the given pixel dimensions (top-left anchored crop/pad),
   * re-encoding each frame's pixelData against the project palette.
   * @param sprites - Sprites to resize.
   * @param widthPx - New width in pixels.
   * @param heightPx - New height in pixels.
   * @param palette - Project palette used for re-encoding.
   */
  async resizeSprites(
    sprites: Sprite[],
    widthPx: number,
    heightPx: number,
    palette: string[],
  ): Promise<void> {
    for (const sprite of sprites) {
      const indices = cropOrPadIndices(sprite.paletteIndices ?? [], widthPx, heightPx);
      await this.db.sprites.update(sprite.id, {
        width: widthPx,
        height: heightPx,
        paletteIndices: indices,
        pixelData: encodePixelData(indices, palette),
      });
    }
  }
}
