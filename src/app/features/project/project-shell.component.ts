import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Root layout for the project workspace, hosting the router outlet.
 * Navigation has been moved to the global AppComponent top bar.
 */
@Component({
  selector: 'rk-project-shell',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<router-outlet />',
  styleUrl: './project-shell.component.scss',
})
export class ProjectShellComponent {}
