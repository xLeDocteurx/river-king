import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ThemeService } from './core/services/theme.service';
import { ToastComponent } from './shared/components/toast/toast.component';

/**
 * Root application component.
 *
 * Provides a global top bar with branding, contextual project navigation,
 * and dark-mode toggle. Hosts the router outlet below.
 */
@Component({
  imports: [RouterOutlet, RouterLink, ToastComponent],
  selector: 'rk-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class App {
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

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
      } else {
        this.projectId.set(null);
        this.isProjectRoute.set(false);
      }
    });
  }
}
