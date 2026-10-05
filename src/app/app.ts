import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ThemeService } from './core/services/theme.service';
import { StatusBarService } from './core/services/status-bar.service';
import { SessionService, screenFromUrl } from './core/services/session.service';
import { UndoService } from './core/services/undo.service';
import { KeyboardShortcutsService } from './core/services/keyboard-shortcuts.service';
import { DemoProjectService } from './core/services/demo-project.service';
import { NotificationService } from './core/services/notification.service';
import { registerGameAction, DEMO_ACTION_ID, DEMO_ACTION_TOAST } from './core/actions/game-actions';
import { APP_VERSION } from './core/app-version';
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
export class App implements OnInit {
  protected readonly theme = inject(ThemeService);
  protected readonly status = inject(StatusBarService);

  /** Footer branding label, e.g. "River King Engine — v0.1.0". */
  protected readonly versionLabel = `River King Engine — v${APP_VERSION}`;
  private readonly router = inject(Router);
  private readonly sessions = inject(SessionService);
  private readonly undo = inject(UndoService);
  private readonly shortcuts = inject(KeyboardShortcutsService);
  private readonly demo = inject(DemoProjectService);
  private readonly notify = inject(NotificationService);

  /** Whether the current route is under /project/:id (shows workspace nav). */
  isProjectRoute = signal(false);
  /** Project id extracted from the current URL when inside a project. */
  projectId = signal<string | null>(null);

  /** Registers the demo game action and seeds the demo project once. */
  ngOnInit(): void {
    registerGameAction(DEMO_ACTION_ID, () => this.notify.info(DEMO_ACTION_TOAST));
    void this.demo.ensureDemo();
  }

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
