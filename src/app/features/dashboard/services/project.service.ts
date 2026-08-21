import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import type { Project } from '../../../shared/models/project.model';

export interface CreateProjectDto {
  name: string;
  palette: string[];
  tileSize: number;
  mapWidth: number;
  mapHeight: number;
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly db = inject(DatabaseService);

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

  async getAll(): Promise<Project[]> {
    return this.db.projects.orderBy('updatedAt').reverse().toArray();
  }

  async getById(id: string): Promise<Project | undefined> {
    return this.db.projects.get(id);
  }

  async update(id: string, changes: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<void> {
    await this.db.projects.update(id, { ...changes, updatedAt: Date.now() });
  }

  async delete(id: string): Promise<void> {
    await this.db.projects.delete(id);
    // Cascade: delete related entities
    await this.db.scenes.where('projectId').equals(id).delete();
    await this.db.tiles.where('projectId').equals(id).delete();
    await this.db.sprites.where('projectId').equals(id).delete();
    await this.db.sessions.where('projectId').equals(id).delete();
  }
}
