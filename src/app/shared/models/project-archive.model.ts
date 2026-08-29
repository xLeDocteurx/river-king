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