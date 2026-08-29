import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ThemeService } from './core/services/theme.service';
import { StatusBarService } from './core/services/status-bar.service';
import { SessionService, screenFromUrl } from './core/services/session.service';
import { UndoService } from './core/services/undo.service';
import { KeyboardShortcutsService } from './core/services/keyboard-shortcuts.service';
import { ToastComponent } from './shared/components/toast/toast.component';

/**
 * Root application component.
 *
 * Provides a global top bar with branding, contextual project navigation,
 * and dark-mode toggle, plus the app-wide status bar. Hosts the router
 * outlet between them.
 */
@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastComponent],
  selector: 'rk-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly status = inject(StatusBarService);
  private readonly router = inject(Router);
  private readonly sessions = inject(SessionService);
  private readonly undo = inject(UndoService);
  private readonly shortcuts = inject(KeyboardShortcutsService);

  /** Whether the current route is under /project/:id (shows workspace nav). */
  isProjectRoute = signal(false);
  /** Project id extracted from the current URL when inside a project. */
  projectId = signal<string | null>(null);

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((event) => {
      const nav = event as NavigationEnd;
      const match = nav.urlAfterRedirects.match(/^\/project\/([^/]+)/);
      if (match) {
        this.projectId.set(match[1]);
        this.isProjectRoute.set(true);
        const screen = screenFromUrl(nav.urlAfterRedirects);
        if (screen) {
          void this.sessions.updateSession(match[1], { lastScreen: screen });
        }
      } else {
        this.projectId.set(null);
        this.isProjectRoute.set(false);
      }
    });

    effect(() => {
      this.projectId();
      this.undo.clear();
    });
  }
}
