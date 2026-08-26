/** Screens of a project workspace that session state can point back to. */
export type ProjectScreen = 'scenes' | 'tiles' | 'sprites';

/** Persisted per-project UI session: last screen, element, and camera. */
export interface Session {
  /** Owning project id (primary key). */
  projectId: string;
  /** Workspace screen the user was last on. */
  lastScreen: ProjectScreen;
  /** Scene selected when the user left the scenes screen (null if none). */
  lastSceneId: string | null;
  /** Tile selected when the user left the tiles screen (null if none). */
  lastTileId: number | null;
  /** Sprite selected when the user left the sprites screen (null if none). */
  lastSpriteId: number | null;
}

/**
 * Builds a default session for a project.
 * @param projectId - Id of the owning project.
 * @returns A fresh session pointing at the scenes screen.
 */
export function createEmptySession(projectId: string): Session {
  return {
    projectId,
    lastScreen: 'scenes',
    lastSceneId: null,
    lastTileId: null,
    lastSpriteId: null,
  };
}
