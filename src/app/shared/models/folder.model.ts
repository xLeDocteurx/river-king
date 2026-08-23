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
