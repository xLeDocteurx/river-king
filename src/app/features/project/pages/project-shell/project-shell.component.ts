import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProjectSidebarComponent } from '../../components/project-sidebar/project-sidebar.component';

@Component({
  selector: 'rk-project-shell',
  standalone: true,
  imports: [RouterOutlet, ProjectSidebarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-flex tw-h-screen tw-bg-background tw-text-foreground">
      <rk-project-sidebar projectId="" />
      <main class="tw-flex-1 tw-overflow-auto tw-p-4">
        <router-outlet />
      </main>
    </div>
  `,
})
export class ProjectShellComponent {}
