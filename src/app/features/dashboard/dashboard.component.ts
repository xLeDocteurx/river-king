import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  viewChild,
  effect,
  ElementRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { ProjectService } from './services/project.service';
import { StatusBarService } from '../../core/services/status-bar.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  ProjectIoService,
  ProjectImportError,
  type ImportMode,
} from '../../core/services/project-io.service';
import type { Project } from '../../shared/models/project.model';
import type { ProjectArchive } from '../../shared/models/project-archive.model';
import { ProjectCardComponent } from './project-card.component';
import { ProjectCreateDialogComponent } from './project-create-dialog.component';
import { ImportProjectDialogComponent } from './import-project-dialog/import-project-dialog.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';

/**
 * Presents the dashboard with a list of projects, creation dialog, and deletion confirmation.
 */
@Component({
  selector: 'rk-dashboard',
  standalone: true,
  imports: [
    ProjectCardComponent,
    ProjectCreateDialogComponent,
    ImportProjectDialogComponent,
    ConfirmDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly statusBar = inject(StatusBarService);
  private readonly projectIo = inject(ProjectIoService);
  private readonly notification = inject(NotificationService);

  /** Signal holding the list of loaded projects. */
  projects = signal<Project[]>([]);

  /** Signal holding the ID of the project currently marked for deletion, or null. */
  projectToDelete = signal<string | null>(null);

  /** Parsed archive awaiting an import target choice, or null. */
  pendingImport = signal<{ text: string; archive: ProjectArchive } | null>(null);

  /** Template reference to the hidden file picker input. */
  fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  /** Template reference to the delete confirmation dialog component. */
  confirmDialog = viewChild.required(ConfirmDialogComponent);

  /** Template reference to the import target dialog component. */
  importDialog = viewChild.required(ImportProjectDialogComponent);

  /** Static data configuration for the delete confirmation dialog. */
  readonly deleteDialogData: ConfirmDialogData = {
    title: 'Delete Project',
    message: 'Are you sure you want to delete this project? This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  };

  constructor() {
    this.loadProjects();

    effect(() => {
      this.statusBar.setContext(this.countLabel(this.projects().length));
    });

    effect(() => {
      if (this.projectToDelete()) {
        this.confirmDialog().open();
      }
    });

    effect(() => {
      if (this.pendingImport()) {
        this.importDialog().open();
      }
    });
  }

  /** Loads projects from the service into the projects signal. */
  async loadProjects(): Promise<void> {
    try {
      const projects = await this.projectService.getAll();
      this.projects.set(projects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }

  /**
   * Navigates to the selected project page.
   * @param id Project identifier.
   */
  openProject(id: string): void {
    this.router.navigate(['/project', id]);
  }

  /**
   * Marks a project for deletion by setting the projectToDelete signal.
   * @param id Project identifier.
   */
  requestDelete(id: string): void {
    this.projectToDelete.set(id);
  }

  /**
   * Permanently removes the project and refreshes the list.
   * @param id Project identifier.
   */
  async deleteProject(id: string): Promise<void> {
    try {
      await this.projectService.delete(id);
      this.projectToDelete.set(null);
      this.loadProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  }

  /**
   * Builds the pluralized project count label for the status bar.
   * @param count Number of projects.
   * @returns Label such as "1 project" or "3 projects".
   */
  countLabel(count: number): string {
    return `${count} ${count === 1 ? 'project' : 'projects'}`;
  }

  /** Opens the hidden file picker for archive import. */
  openImportPicker(): void {
    this.fileInput().nativeElement.click();
  }

  /**
   * Reads the picked file, validates it, and stages it for the import dialog.
   * @param event The file input change event.
   */
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const archive = this.projectIo.parsePreview(text);
      this.pendingImport.set({ text, archive });
    } catch (error) {
      if (error instanceof ProjectImportError) {
        this.notification.error(error.message);
      } else {
        console.error('Failed to read import file:', error);
        this.notification.error('Failed to read the file');
      }
    } finally {
      input.value = '';
    }
  }

  /**
   * Runs the actual import for the staged file with the chosen target mode,
   * then refreshes the list and navigates to the resulting project.
   * @param mode Import target: brand-new or replace an existing project.
   */
  async importProjectFromFile(mode: ImportMode): Promise<void> {
    const pending = this.pendingImport();
    if (!pending) return;
    try {
      const { projectId } = await this.projectIo.importProject(pending.text, mode);
      this.pendingImport.set(null);
      this.importDialog().close();
      this.notification.success('Project imported');
      await this.loadProjects();
      await this.router.navigate(['/project', projectId]);
    } catch (error) {
      if (error instanceof ProjectImportError) {
        this.notification.error(error.message);
      } else {
        console.error('Failed to import project:', error);
        this.notification.error('Failed to import project');
      }
    }
  }

  /** Drops the staged file, e.g. when the user dismisses the import dialog. */
  clearPendingImport(): void {
    this.pendingImport.set(null);
  }
}
