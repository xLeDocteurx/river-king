import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import type { Project } from '../../shared/models/project.model';

/**
 * Displays a single project card with metadata, palette preview, and open/delete actions.
 */
@Component({
  selector: 'rk-project-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-card.component.html',
  styleUrl: './project-card.component.scss',
})
export class ProjectCardComponent {
  /** Required project data input. */
  project = input.required<Project>();

  /** Emitted when the user chooses to open the project. */
  open = output<string>();

  /** Emitted when the user chooses to delete the project. */
  delete = output<string>();

  /**
   * Formats a timestamp to a locale date string.
   * @param timestamp Unix timestamp.
   * @returns Localized date string.
   */
  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }
}
