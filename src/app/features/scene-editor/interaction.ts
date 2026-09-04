import type { Layer } from '../../shared/models/scene.model';

/** The cell `E` targets, with the action registered on its tile. */
export interface InteractionTarget {
  /** Target cell column. */
  x: number;
  /** Target cell row. */
  y: number;
  /** Action id registered on the tile, used with GAME_ACTIONS. */
  actionId: string;
}

/**
 * Returns the effective tile id at a cell, following rendering order: the
 * topmost visible layer wins. Hidden layers are skipped. `-1` (empty) when no
 * layer paints that cell.
 *
 * @param x      - Cell column.
 * @param y      - Cell row.
 * @param layers - Scene layers; the LAST visible layer with a tile wins.
 * @returns The tile id painted at the cell, or `-1` when empty.
 */
export function topmostTileIdAt(x: number, y: number, layers: Layer[]): number {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer.visible) continue;
    const row = layer.tileData[y];
    if (!row) continue;
    const tileId = row[x] ?? -1;
    if (tileId >= 0) return tileId;
  }
  return -1;
}

/**
 * Finds the interactable tile `E` should trigger for a player: the facing cell
 * first, then the cell under the player.
 *
 * @param cell       - Cell under the player center.
 * @param direction  - Facing direction ({dx, dy}), each in {-1, 0, 1}.
 * @param layers     - Scene layers.
 * @param interactableById - Map of tileId -> actionId for interactable tiles.
 * @returns {x, y, actionId} for the target, or `null` when nothing is in range.
 */
export function findInteractableTarget(
  cell: { x: number; y: number },
  direction: { dx: number; dy: number },
  layers: Layer[],
  interactableById: Map<number, string>,
): InteractionTarget | null {
  const facingX = cell.x + direction.dx;
  const facingY = cell.y + direction.dy;
  const facingId = topmostTileIdAt(facingX, facingY, layers);
  const facingAction = facingId >= 0 ? interactableById.get(facingId) : undefined;
  if (facingAction) {
    return { x: facingX, y: facingY, actionId: facingAction };
  }

  const belowId = topmostTileIdAt(cell.x, cell.y, layers);
  const belowAction = belowId >= 0 ? interactableById.get(belowId) : undefined;
  if (belowAction) {
    return { x: cell.x, y: cell.y, actionId: belowAction };
  }

  return null;
}
