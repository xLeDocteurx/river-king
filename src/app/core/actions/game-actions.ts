/** Handler signature for game actions triggered by interactable tiles. */
export type GameActionHandler = () => void;

/**
 * Registry mapping action ids to handlers. Tiles store only the id,
 * so new handler shapes can be introduced without data migrations.
 */
export const GAME_ACTIONS: Record<string, GameActionHandler> = {
  test: () => undefined,
};

/** Action id of the demo project's interactable sign. */
export const DEMO_ACTION_ID = 'demo';
/** Toast shown when the demo sign is activated. */
export const DEMO_ACTION_TOAST = 'This is the River King demo project.';

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

/**
 * Registers (or overwrites) the handler for an action id. The last
 * registration wins, keeping the registry mutable without data migrations.
 * @param id - Action id stored on tiles.
 * @param handler - Handler invoked by {@link runGameAction}.
 */
export function registerGameAction(id: string, handler: GameActionHandler): void {
  GAME_ACTIONS[id] = handler;
}
