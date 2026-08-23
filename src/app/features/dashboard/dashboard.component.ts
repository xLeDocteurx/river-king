import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  viewChild,
  effect,
} from '@angular/core';
import { Router } from '@angular/router';
import { ProjectService } from './services/project.service';
import type { Project } from '../../shared/models/project.model';
import { ProjectCardComponent } from './project-card.component';
import { ProjectCreateDialogComponent } from './project-create-dialog.component';
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
  imports: [ProjectCardComponent, ProjectCreateDialogComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);

  /** Signal holding the list of loaded projects. */
  projects = signal<Project[]>([]);

  /** Signal holding the ID of the project currently marked for deletion, or null. */
  projectToDelete = signal<string | null>(null);

  /** Static data configuration for the delete confirmation dialog. */
  readonly deleteDialogData: ConfirmDialogData = {
    title: 'Delete Project',
    message: 'Are you sure you want to delete this project? This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  };

  /** Template reference to the delete confirmation dialog component. */
  confirmDialog = viewChild.required(ConfirmDialogComponent);

  constructor() {
    this.loadProjects();

    effect(() => {
      if (this.projectToDelete()) {
        this.confirmDialog().open();
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
}
