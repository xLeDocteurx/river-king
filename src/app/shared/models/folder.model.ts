/**
 * Which folder-based list a folder row belongs to. Scene folders and tile
 * folders sharing the same path must not collide, so this discriminator is
 * part of the row's composite identity `(projectId, kind, path)`.
 */
export type FolderKind = 'scene' | 'tile';

/**
 * A user-created folder used to group scenes or tiles within a project.
 */
export interface Folder {
  /** Unique identifier (UUID). */
  id: string;
  /** Id of the project this folder belongs to. */
  projectId: string;
  /** Folder path displayed to the user (e.g. "forest/caves" or "forest"). */
  path: string;
  /** Which list this folder row belongs to (`'scene'` or `'tile'`). */
  kind: FolderKind;
  /** Manual override: `true` keeps the folder folded, `false` keeps it expanded. */
  collapsed: boolean;
  /** Epoch ms of the last interaction (selecting an item inside or manual toggle), 0 if never. */
  lastOpenedAt: number;
}

/** Number of top-level folders above which lists fold folders by default. */
export const FOLDER_FOLD_THRESHOLD = 6;

/**
 * Rewrites `path` to its new location after a folder rename. The path is
 * rewritten when it equals `from` exactly or lives beneath `from/...`.
 * Unrelated paths are returned unchanged.
 * @param path - The path to rewrite (e.g. a scene or folder path).
 * @param from - The folder path being renamed.
 * @param to - The new folder path.
 * @returns The rewritten path, or `path` when it is not affected.
 */
export function rewriteFolderPath(path: string, from: string, to: string): string {
  if (from === path) return to;
  if (path.startsWith(from + '/')) return to + path.slice(from.length);
  return path;
}

/**
 * Computes the set of folder paths that should render collapsed.
 *
 * Rule: a path is collapsed when its row was explicitly collapsed
 * (`collapsed === true`), or when the user never touched it (no row with
 * `lastOpenedAt > 0`) and the number of distinct top-level folders exceeds
 * the threshold. The ungrouped root (`''`) is never folded.
 * @param rows - Persisted folder rows for the list's kind (empty for a flat project).
 * @param paths - Every rendered folder path (derived paths + persisted rows).
 * @param threshold - Top-level folder count that triggers default folding.
 * @returns Distinct collapsed folder paths, in `paths` order.
 */
export function computeCollapsedKeys(
  rows: Pick<Folder, 'path' | 'collapsed' | 'lastOpenedAt'>[],
  paths: string[],
  threshold: number = FOLDER_FOLD_THRESHOLD,
): string[] {
  const nonEmpty = paths.filter((path) => path !== '');
  const topLevelCount = new Set(nonEmpty.map((path) => path.split('/')[0])).size;
  const defaultCollapsed = topLevelCount > threshold;
  const collapsed = new Set<string>();
  for (const path of paths) {
    if (path === '') continue;
    const row = rows.find((r) => r.path === path);
    if (row?.collapsed) {
      collapsed.add(path);
    } else if (!(row && row.lastOpenedAt > 0) && defaultCollapsed) {
      collapsed.add(path);
    }
  }
  return Array.from(collapsed);
}
