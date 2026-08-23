import { Component, ChangeDetectionStrategy, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { LOSPEC_PALETTES } from '../../core/palettes/lospec-palettes';
import { NotificationService } from '../../core/services/notification.service';
import { ProjectService } from './services/project.service';

/**
 * Modal dialog for creating a new project.
 *
 * Wraps the native `<rk-dialog>` element and owns the creation form. On
 * submit it creates the project through `ProjectService` with the palette
 * chosen in the dialog (Sweetie 16 by default), closes itself, and navigates
 * to the new project.
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

  /** Id of the palette selected in the picker (Sweetie 16 by default). */
  readonly selectedPaletteId = signal<string>('sweetie-16');

  /** Palettes offered by the picker. */
  readonly palettes = LOSPEC_PALETTES;

  /**
   * Selects a palette in the picker.
   * @param id - Palette id chosen by the user.
   */
  selectPalette(id: string): void {
    this.selectedPaletteId.set(id);
  }

  /** Returns the currently selected palette definition. */
  private selectedPalette() {
    return this.palettes.find((p) => p.id === this.selectedPaletteId()) ?? this.palettes[0];
  }

  /**
   * Opens the creation dialog and resets any previous draft name.
   */
  open(): void {
    this.projectName.set('');
    this.selectedPaletteId.set('sweetie-16');
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
        palette: this.selectedPalette().colors.map((c) => `#${c}`),
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
