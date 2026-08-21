import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../core/services/database.service';
import type { Session } from '../../shared/models/session.model';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly db = inject(DatabaseService);

  async getSession(projectId: string): Promise<Session | undefined> {
    return this.db.sessions.get(projectId);
  }

  async saveSession(session: Session): Promise<void> {
    await this.db.sessions.put(session);
  }

  async updateSession(projectId: string, updates: Partial<Session>): Promise<void> {
    await this.db.sessions.update(projectId, updates);
  }

  async deleteSession(projectId: string): Promise<void> {
    await this.db.sessions.delete(projectId);
  }
}
