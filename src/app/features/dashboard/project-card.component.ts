import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import type { Project } from '../../shared/models/project.model';

/**
 * Displays a single project as a clickable editor-style card: name, meta line, palette preview, and a hover delete action.
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

  /**
   * Activates the card's primary action: emits the open output with the project id.
   */
  activate(): void {
    this.open.emit(this.project().id);
  }

  /**
   * Handles a delete click without triggering the card's open action.
   * @param event DOM click event, stopped so it does not bubble to the card root.
   */
  onDelete(event: Event): void {
    event.stopPropagation();
    this.delete.emit(this.project().id);
  }
}
