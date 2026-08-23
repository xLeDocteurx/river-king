/** Handler signature for game actions triggered by interactable tiles. */
export type GameActionHandler = () => void;

/**
 * Registry mapping action ids to handlers. Tiles store only the id,
 * so new handler shapes can be introduced without data migrations.
 */
export const GAME_ACTIONS: Record<string, GameActionHandler> = {
  test: () => alert('alert'),
};

/**
 * Lists all registered action ids.
 * @returns Array of action ids in registration order.
 */
export function listGameActions(): string[] {
  return Object.keys(GAME_ACTIONS);
}

/**
 * Runs a registered action by id.
 * @param id - Action id stored on the tile.
 * No-op when the id is unknown so stale data cannot crash the runtime.
 */
export function runGameAction(id: string): void {
  GAME_ACTIONS[id]?.();
}
