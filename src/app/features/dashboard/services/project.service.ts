import { Injectable, inject, signal } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import type { Project } from '../../../shared/models/project.model';

/**
 * Data-transfer object for creating a new project.
 *
 * `id`, `createdAt`, and `updatedAt` are generated automatically.
 */
export interface CreateProjectDto {
  /** Human-readable project name. */
  name: string;
  /** Initial hex-color palette (e.g. `["#000000", "#ffffff"]`). */
  palette: string[];
  /** Tile side length in pixels (typically `16`). */
  tileSize: number;
  /** Map width in tiles. */
  mapWidth: number;
  /** Map height in tiles. */
  mapHeight: number;
}

/**
 * Application-level service for CRUD operations on projects.
 *
 * Wraps {@link DatabaseService} and handles ID generation, timestamps,
 * and cascade deletion of related entities.
 */
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly db = inject(DatabaseService);
  private readonly currentProjectSignal = signal<Project | null>(null);

  /**
   * The project currently open in a workspace, or `null` on the dashboard.
   *
   * Set by the route guard when navigation enters a `project/:id` workspace
   * so editors can read it without re-fetching the database.
   */
  readonly currentProject = this.currentProjectSignal.asReadonly();

  /**
   * Update the currently-open project, or clear it (`null`) when leaving a workspace.
   *
   * @param project - The project to expose, or `null` to reset.
   */
  setCurrentProject(project: Project | null): void {
    this.currentProjectSignal.set(project);
  }

  /**
   * Persist a new project.
   *
   * A UUID and current timestamp are assigned automatically.
   *
   * @param dto - Project data without `id` or timestamp fields.
   * @returns The newly created {@link Project} with its generated `id`.
   * @throws Will throw if the underlying IndexedDB write fails.
   */
  async create(dto: CreateProjectDto): Promise<Project> {
    const now = Date.now();
    const project: Project = {
      id: crypto.randomUUID(),
      ...dto,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.projects.add(project);
    return project;
  }

  /**
   * Retrieve all projects ordered by most-recently-updated first.
   *
   * @returns Array of projects sorted descending by `updatedAt`.
   */
  async getAll(): Promise<Project[]> {
    return this.db.projects.orderBy('updatedAt').reverse().toArray();
  }

  /**
   * Look up a single project by its identifier.
   *
   * @param id - The project UUID.
   * @returns The matching {@link Project}, or `undefined` if not found.
   */
  async getById(id: string): Promise<Project | undefined> {
    return this.db.projects.get(id);
  }

  /**
   * Apply partial updates to an existing project.
   *
   * The `updatedAt` timestamp is set to the current time automatically.
   *
   * @param id - The project UUID.
   * @param changes - Fields to update (`id` and `createdAt` are immutable).
   */
  async update(id: string, changes: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<void> {
    await this.db.projects.update(id, { ...changes, updatedAt: Date.now() });
  }

  /**
   * Delete a project and cascade-delete all related entities.
   *
   * Removes associated scenes, tiles, sprites, and sessions.
   *
   * @param id - The project UUID.
   */
  async delete(id: string): Promise<void> {
    await this.db.projects.delete(id);
    // Cascade: delete related entities
    await this.db.scenes.where('projectId').equals(id).delete();
    await this.db.tiles.where('projectId').equals(id).delete();
    await this.db.sprites.where('projectId').equals(id).delete();
    await this.db.sessions.where('projectId').equals(id).delete();
  }
}
