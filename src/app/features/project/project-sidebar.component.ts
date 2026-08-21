import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/**
 * Sidebar navigation for the project workspace (Scenes, Tiles, Sprites).
 */
@Component({
  selector: 'rk-project-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-sidebar.component.html',
  styleUrl: './project-sidebar.component.scss',
})
export class ProjectSidebarComponent {
  /** Required project identifier from the parent route. */
  projectId = input.required<string>();
}
