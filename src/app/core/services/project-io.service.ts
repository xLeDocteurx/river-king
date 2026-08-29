import { Injectable, inject } from '@angular/core';
import { DatabaseService } from './database.service';
import {
  PROJECT_ARCHIVE_FORMAT,
  PROJECT_ARCHIVE_VERSION,
  type ProjectArchive,
  type SceneArchiveItem,
  type SpriteArchiveItem,
  type TileArchiveItem,
} from '../../shared/models/project-archive.model';

/**
 * Import target choice: a brand-new project or an in-place replacement.
 */
export type ImportMode =
  /**
   * Create a fresh project with a new UUID.
   */
  | { kind: 'new' }
  /**
   * Replace the content of an existing project, keeping its UUID.
   */
  | { kind: 'replace'; targetProjectId: string };

/**
 * Outcome of a successful import.
 */
export interface ImportResult {
  /**
   * Id of the project that received the imported content.
   */
  projectId: string;
  /**
   * Whether the project was created fresh or replaced.
   */
  kind: 'new' | 'replace';
}

/**
 * Raised when an archive file cannot be imported, with a user-readable message.
 */
export class ProjectImportError extends Error {}

/**
 * Type guard for plain objects.
 * @param value - The value to inspect.
 * @returns True when the value is a non-null object (incl. arrays).
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Owns project serialization: exports a project to a `.rkproj` JSON string,
 * validates archives, and imports them with full atomic id remapping.
 */
@Injectable({ providedIn: 'root' })
export class ProjectIoService {
  private readonly db = inject(DatabaseService);

  /**
   * Serializes a whole project (settings, tiles, sprites, scenes, folders)
   * into a deterministic JSON string with embedded PNG base64 frames.
   * @param projectId - Id of the project to export.
   * @returns The archive JSON string.
   * @throws Error when the project does not exist.
   */
  async exportProject(projectId: string): Promise<string> {
    const [project, tiles, sprites, folders, scenes] = await Promise.all([
      this.db.projects.get(projectId),
      this.db.tiles.where('projectId').equals(projectId).sortBy('id'),
      this.db.sprites.where('projectId').equals(projectId).sortBy('id'),
      this.db.folders.where('projectId').equals(projectId).toArray(),
      this.db.scenes.where('projectId').equals(projectId).toArray(),
    ]);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    const archive: ProjectArchive = {
      format: PROJECT_ARCHIVE_FORMAT,
      formatVersion: PROJECT_ARCHIVE_VERSION,
      exportedAt: Date.now(),
      project: {
        name: project.name,
        palette: [...project.palette],
        tileSize: project.tileSize,
        mapWidth: project.mapWidth,
        mapHeight: project.mapHeight,
      },
      tiles: tiles.map((t): TileArchiveItem => ({
        sourceId: t.id,
        name: t.name,
        type: t.type,
        spriteIds: [...t.spriteIds],
        animationSpeed: t.animationSpeed,
        properties: { ...t.properties },
        folderPath: t.folderPath ?? '',
      })),
      sprites: sprites.map((s): SpriteArchiveItem => ({
        sourceId: s.id,
        tileSourceId: s.tileId,
        name: s.name,
        width: s.width,
        height: s.height,
        pixelData: s.pixelData,
        paletteIndices: s.paletteIndices?.map((row) => [...row]),
      })),
      scenes: scenes.map((sc): SceneArchiveItem => ({
        name: sc.name,
        folderPath: sc.folderPath,
        width: sc.width,
        height: sc.height,
        layers: sc.layers.map((l) => ({
          id: l.id,
          name: l.name,
          visible: l.visible,
          opacity: l.opacity,
          tileData: l.tileData.map((row) => [...row]),
        })),
      })),
      folders: [...new Set(folders.map((f) => f.path))],
    };
    return JSON.stringify(archive);
  }

  /**
   * Validates an archive file and returns its parsed, structure-checked form.
   * @param fileText - Raw file content.
   * @returns The validated archive.
   * @throws ProjectImportError with a user-facing message.
   */
  parsePreview(fileText: string): ProjectArchive {
    return this.validate(fileText);
  }

  /**
   * Imports an archive file into the database.
   * @param fileText - Raw file content.
   * @param mode - Fresh project or replace an existing one.
   * @returns The id of the project that received the content.
   * @throws ProjectImportError when the file is invalid.
   */
  async importProject(fileText: string, mode: ImportMode): Promise<ImportResult> {
    void mode;
    throw new ProjectImportError('Import is not implemented yet');
  }

  private validate(_fileText: string): ProjectArchive {
    throw new ProjectImportError('Import is not implemented yet');
  }
}