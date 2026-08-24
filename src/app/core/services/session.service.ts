import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../core/services/database.service';
import type { ProjectScreen, Session } from '../../shared/models/session.model';
import { createEmptySession } from '../../shared/models/session.model';

/**
 * Extracts the project workspace screen from a router URL.
 * @param url - Router URL (e.g. `/project/p1/tiles`).
 * @returns The screen name, or null when the URL is outside a screen.
 */
export function screenFromUrl(url: string): ProjectScreen | null {
  const match = url.match(/^\/project\/[^/]+\/(scenes|tiles|sprites)(?:[/?]|$)/);
  return (match?.[1] as ProjectScreen | undefined) ?? null;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly db = inject(DatabaseService);

  /**
   * Reads the persisted session of a project.
   * @param projectId - Id of the owning project.
   * @returns The session, or undefined when none was saved yet.
   */
  async getSession(projectId: string): Promise<Session | undefined> {
    return this.db.sessions.get(projectId);
  }

  /**
   * Writes a complete session, replacing any existing one.
   * @param session - Full session to persist.
   */
  async saveSession(session: Session): Promise<void> {
    await this.db.sessions.put(session);
  }

  /**
   * Partially updates a session, creating it with defaults when missing and
   * backfilling defaults for fields absent from legacy rows.
   * @param projectId - Id of the owning project.
   * @param updates - Fields to overwrite.
   */
  async updateSession(projectId: string, updates: Partial<Session>): Promise<void> {
    const existing = await this.db.sessions.get(projectId);
    const next: Session = {
      ...createEmptySession(projectId),
      ...(existing ?? {}),
      projectId,
      ...updates,
    };
    await this.db.sessions.put(next);
  }

  /**
   * Removes the persisted session of a project.
   * @param projectId - Id of the owning project.
   */
  async deleteSession(projectId: string): Promise<void> {
    await this.db.sessions.delete(projectId);
  }
}
