import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ProjectService } from '../dashboard/services/project.service';

/**
 * Blocks navigation into a project workspace when the targeted project does
 * not exist (or the route lacks an `id`). When the project exists, it is
 * exposed on {@link ProjectService.currentProject} so feature components can
 * read it without re-fetching the database.
 *
 * @param route - The activated route being navigated to.
 * @returns `true` to allow navigation, or a URL tree redirecting to the dashboard.
 */
export const projectExistsGuard: CanActivateFn = async (route) => {
  const projectService = inject(ProjectService);
  const router = inject(Router);
  const id = route.paramMap.get('id');
  if (!id) {
    return router.createUrlTree(['/']);
  }
  const project = await projectService.getById(id);
  if (!project) {
    return router.createUrlTree(['/']);
  }
  projectService.setCurrentProject(project);
  return true;
};
