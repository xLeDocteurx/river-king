import { Injectable, inject } from '@angular/core';
import { DatabaseService } from './database.service';
import type { Tile } from '../../shared/models/tile.model';
import type { Sprite } from '../../shared/models/sprite.model';
import type { FolderKind } from '../../shared/models/folder.model';
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
        spawnPoint: sc.spawnPoint ?? null,
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
    const archive = this.validate(fileText);
    const projectId = mode.kind === 'new' ? crypto.randomUUID() : mode.targetProjectId;
    const now = Date.now();
    const projectRow = {
      id: projectId,
      name: archive.project.name,
      createdAt: now,
      updatedAt: now,
      palette: [...archive.project.palette],
      tileSize: archive.project.tileSize,
      mapWidth: archive.project.mapWidth,
      mapHeight: archive.project.mapHeight,
    };

    const tileIdMap = new Map<number, number>();
    const spriteIdMap = new Map<number, number>();

    await this.db.transaction(
      'rw',
      [
        this.db.projects,
        this.db.tiles,
        this.db.sprites,
        this.db.scenes,
        this.db.folders,
        this.db.sessions,
      ],
      async () => {
        if (mode.kind === 'replace') {
          await this.purgeProject(projectId);
        }
        for (const t of archive.tiles) {
          const newId = await this.db.tiles.add({
            projectId,
            name: t.name,
            type: t.type,
            spriteIds: [] as number[],
            animationSpeed: t.animationSpeed,
            properties: { ...t.properties },
            folderPath: t.folderPath,
          } as Tile);
          tileIdMap.set(t.sourceId, newId);
        }
        for (const s of archive.sprites) {
          const newId = await this.db.sprites.add({
            projectId,
            tileId: tileIdMap.get(s.tileSourceId)!,
            name: s.name,
            width: s.width,
            height: s.height,
            pixelData: s.pixelData,
            paletteIndices: s.paletteIndices?.map((row) => [...row]),
          } as Sprite);
          spriteIdMap.set(s.sourceId, newId);
        }
        for (const t of archive.tiles) {
          const newId = tileIdMap.get(t.sourceId)!;
          await this.db.tiles.update(newId, {
            spriteIds: t.spriteIds.map((sid) => spriteIdMap.get(sid)!),
          });
        }
        for (const sc of archive.scenes) {
          await this.db.scenes.add({
            id: crypto.randomUUID(),
            projectId,
            name: sc.name,
            folderPath: sc.folderPath,
            spawnPoint: sc.spawnPoint ?? null,
            width: sc.width,
            height: sc.height,
            layers: sc.layers.map((l) => ({
              id: l.id,
              name: l.name,
              visible: l.visible,
              opacity: l.opacity,
              tileData: l.tileData.map((row) =>
                row.map((tid) => (tid < 0 ? tid : tileIdMap.get(tid)!)),
              ),
            })),
          });
        }
        const scenePaths = new Set(archive.scenes.map((sc) => sc.folderPath));
        const tilePaths = new Set(archive.tiles.map((t) => t.folderPath));
        for (const path of archive.folders) {
          const kinds: FolderKind[] = [];
          if (scenePaths.has(path)) kinds.push('scene');
          if (tilePaths.has(path)) kinds.push('tile');
          if (kinds.length === 0) kinds.push('scene');
          for (const kind of kinds) {
            await this.db.folders.add({
              id: crypto.randomUUID(),
              projectId,
              path,
              kind,
              collapsed: false,
              lastOpenedAt: 0,
            });
          }
        }
        await this.db.projects.delete(projectId);
        await this.db.projects.add(projectRow);
      },
    );

    return { projectId, kind: mode.kind };
  }

  /**
   * Deletes every row belonging to a project (scenes, tiles, sprites, folders,
   * sessions — project row excluded).
   * @param projectId - The project to purge.
   */
  private async purgeProject(projectId: string): Promise<void> {
    await this.db.scenes.where('projectId').equals(projectId).delete();
    await this.db.tiles.where('projectId').equals(projectId).delete();
    await this.db.sprites.where('projectId').equals(projectId).delete();
    await this.db.folders.where('projectId').equals(projectId).delete();
    await this.db.sessions.where('projectId').equals(projectId).delete();
  }

  /**
   * Parses and structurally validates an archive file.
   * @param fileText - Raw file content.
   * @returns The validated archive.
   * @throws ProjectImportError with a user-facing message.
   */
  private validate(fileText: string): ProjectArchive {
    let raw: unknown;
    try {
      raw = JSON.parse(fileText);
    } catch {
      throw new ProjectImportError('This file is not a valid project file.');
    }
    if (!isRecord(raw)) {
      throw new ProjectImportError('This file is not a River King project export.');
    }
    const archive = raw as unknown as ProjectArchive;
    if (archive.format !== PROJECT_ARCHIVE_FORMAT) {
      throw new ProjectImportError('This file is not a River King project export.');
    }
    if (archive.formatVersion !== PROJECT_ARCHIVE_VERSION) {
      throw new ProjectImportError(
        `This project file uses an unsupported version (${String(archive.formatVersion)}).`,
      );
    }
    if (!isRecord(archive.project)) {
      throw new ProjectImportError('This file is missing required data.');
    }
    const p = archive.project;
    if (
      typeof p.name !== 'string' ||
      p.name.length === 0 ||
      !Array.isArray(p.palette) ||
      p.palette.some((c) => typeof c !== 'string') ||
      typeof p.tileSize !== 'number' ||
      typeof p.mapWidth !== 'number' ||
      typeof p.mapHeight !== 'number'
    ) {
      throw new ProjectImportError('This file is missing required data.');
    }
    if (!Array.isArray(archive.tiles) || !Array.isArray(archive.sprites)) {
      throw new ProjectImportError('This file is missing required data.');
    }
    if (!Array.isArray(archive.scenes) || !Array.isArray(archive.folders)) {
      throw new ProjectImportError('This file is missing required data.');
    }
    const tileSourceIds = new Set(archive.tiles.map((t) => t.sourceId));
    const spriteSourceIds = new Set(archive.sprites.map((s) => s.sourceId));
    if (archive.sprites.some((s) => !tileSourceIds.has(s.tileSourceId))) {
      throw new ProjectImportError('This file references a missing tile.');
    }
    if (archive.tiles.some((t) => t.spriteIds.some((id) => !spriteSourceIds.has(id)))) {
      throw new ProjectImportError('This file references a missing frame.');
    }
    if (
      archive.scenes.some((scene) =>
        scene.layers.some((layer) =>
          layer.tileData.some((row) => row.some((tid) => tid >= 0 && !tileSourceIds.has(tid))),
        ),
      )
    ) {
      throw new ProjectImportError('This file references a missing tile.');
    }
    return archive;
  }
}
