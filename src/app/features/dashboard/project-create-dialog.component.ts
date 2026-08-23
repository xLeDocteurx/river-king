import { Component, ChangeDetectionStrategy, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { NotificationService } from '../../core/services/notification.service';
import { ProjectService } from './services/project.service';

/**
 * Modal dialog for creating a new project.
 *
 * Wraps the native `<rk-dialog>` element and owns the creation form. On
 * submit it creates the project through `ProjectService` (with the default
 * Sweetie-16 palette), closes itself, and navigates to the new project.
 */
@Component({
  selector: 'rk-project-create-dialog',
  standalone: true,
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-create-dialog.component.html',
  styleUrl: './project-create-dialog.component.scss',
})
export class ProjectCreateDialogComponent {
  /** Reference to the wrapped native dialog. */
  private readonly dialogRef = viewChild.required(DialogComponent);

  /** Service creating the project record. */
  private readonly projectService = inject(ProjectService);

  /** Router used to navigate to the freshly created project. */
  private readonly router = inject(Router);

  /** Service surfacing persistence failures to the user. */
  private readonly notification = inject(NotificationService);

  /** Draft project name bound to the form input. */
  readonly projectName = signal('');

  /**
   * Opens the creation dialog and resets any previous draft name.
   */
  open(): void {
    this.projectName.set('');
    this.dialogRef().open();
  }

  /**
   * Handles form submission: creates the project, closes the dialog and
   * navigates to it.
   * @param event Form submit event.
   */
  async createProject(event: Event): Promise<void> {
    event.preventDefault();
    const name = this.projectName().trim();
    if (!name) return;

    try {
      const project = await this.projectService.create({
        name,
        palette: [
          '#1a1c2c',
          '#5d275d',
          '#b13e53',
          '#ef7d57',
          '#ffcd75',
          '#a7f070',
          '#38b764',
          '#257179',
          '#29366f',
          '#3b5dc9',
          '#41a6f6',
          '#73eff7',
          '#f4f4f4',
          '#94b0c2',
          '#566c86',
          '#333c57',
        ],
        tileSize: 16,
        mapWidth: 40,
        mapHeight: 30,
      });
      this.dialogRef().close();
      await this.router.navigate(['/project', project.id]);
    } catch (error) {
      console.error('Failed to create project:', error);
      this.notification.error('Failed to create project');
    }
  }

  /** Closes the dialog without creating anything. */
  cancel(): void {
    this.dialogRef().close();
  }
}
