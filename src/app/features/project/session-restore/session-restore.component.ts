import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionService } from '../../../core/services/session.service';
import type { ProjectScreen, Session } from '../../../shared/models/session.model';

/**
 * Landing component for `/project/:id` with no explicit screen.
 *
 * Restores the user's last workspace: reads the persisted session and
 * replaces the URL with the screen they left (scenes, tiles, or sprites),
 * carrying the element they were working on as a query param. Falls back
 * to the scenes screen when no session exists.
 */
@Component({
  selector: 'rk-session-restore',
  templateUrl: './session-restore.component.html',
  styleUrl: './session-restore.component.scss',
})
export class SessionRestoreComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly sessions = inject(SessionService);

  /** Redirects to the last visited screen of the project. */
  async ngOnInit(): Promise<void> {
    const projectId = this.route.parent?.snapshot.paramMap.get('id');
    if (!projectId) return;

    const stored = await this.sessions.getSession(projectId).catch(() => undefined);
    const screen: ProjectScreen = stored?.lastScreen ?? 'scenes';
    const elementId = this.elementPathSegment(screen, stored);
    const commands = elementId != null ? [screen, elementId] : [screen];

    await this.router.navigate(commands, { relativeTo: this.route, replaceUrl: true });
  }

  /**
   * Builds the path segment restoring the element worked on for a screen.
   * Tiles and sprites screens encode the selected element in their route
   * (`tiles/:tileId`, `sprites/:spriteId`); scenes selection is restored by
   * the scene editor itself from the session.
   * @param screen - Target workspace screen.
   * @param stored - Persisted session, if any.
   * @returns The element id path segment, or null to target the bare screen.
   */
  private elementPathSegment(screen: ProjectScreen, stored?: Session): number | null {
    switch (screen) {
      case 'tiles':
        return stored?.lastTileId ?? null;
      case 'sprites':
        return stored?.lastSpriteId ?? null;
      case 'scenes':
        return null;
    }
  }
}
