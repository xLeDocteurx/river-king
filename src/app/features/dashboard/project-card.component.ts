import { Component, inject, input, output, ChangeDetectionStrategy } from '@angular/core';
import type { Project } from '../../shared/models/project.model';
import { ProjectIoService } from '../../core/services/project-io.service';
import { NotificationService } from '../../core/services/notification.service';

/**
 * Displays a single project as a clickable editor-style card: name, meta line,
 * palette preview, and hover actions to export or delete.
 */
@Component({
  selector: 'rk-project-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-card.component.html',
  styleUrl: './project-card.component.scss',
})
export class ProjectCardComponent {
  private readonly projectIo = inject(ProjectIoService);
  private readonly notification = inject(NotificationService);

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

  /**
   * Exports the project to a downloadable `.rkproj` file without opening it.
   * @param event - DOM click event, stopped so it does not bubble to the card root.
   */
  async onExport(event: Event): Promise<void> {
    event.stopPropagation();
    const project = this.project();
    try {
      const json = await this.projectIo.exportProject(project.id);
      this.download(json, project.name);
    } catch (error) {
      console.error('Failed to export project:', error);
      this.notification.error('Failed to export project');
    }
  }

  /**
   * Triggers a browser download of the archive JSON.
   * @param json - The archive serialization.
   * @param name - Project name used for the file slug.
   */
  private download(json: string, name: string): void {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `river-king-${this.slugify(name)}.rkproj`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * Lowercases a name and collapses non-alphanumeric runs into dashes.
   * @param name - Raw name.
   * @returns URL-safe slug, never empty.
   */
  private slugify(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'project';
  }
}
