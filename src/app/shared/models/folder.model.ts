/**
 * A user-created scene folder used to group scenes within a project.
 */
export interface Folder {
  /** Unique identifier (UUID). */
  id: string;
  /** Id of the project this folder belongs to. */
  projectId: string;
  /** Folder path displayed to the user (e.g. "forest/caves" or "forest"). */
  path: string;
}

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
