import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProjectSidebarComponent } from '../../components/project-sidebar/project-sidebar.component';

/**
 * Root layout for the project workspace, hosting the sidebar and router outlet.
 */
@Component({
  selector: 'rk-project-shell',
  standalone: true,
  imports: [RouterOutlet, ProjectSidebarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-shell.component.html',
  styleUrl: './project-shell.component.scss',
})
export class ProjectShellComponent {}
