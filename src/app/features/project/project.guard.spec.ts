import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { ProjectService } from '../dashboard/services/project.service';
import type { Project } from '../../shared/models/project.model';
import { projectExistsGuard } from './project.guard';

describe('projectExistsGuard', () => {
  let currentProject: ReturnType<typeof signal<Project | null>>;
  let getByIdSpy: ReturnType<typeof vi.fn>;
  let setCurrentProjectSpy: ReturnType<typeof vi.fn>;
  let createUrlTreeSpy: ReturnType<typeof vi.fn>;

  function paramMap(id: string | null) {
    return {
      paramMap: {
        get: (key: string) => (key === 'id' ? id : null),
      },
    } as unknown as ActivatedRouteSnapshot;
  }

  beforeEach(() => {
    currentProject = signal<Project | null>(null);
    getByIdSpy = vi.fn();
    setCurrentProjectSpy = vi.fn((project: Project | null) => currentProject.set(project));
    createUrlTreeSpy = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ProjectService,
          useValue: {
            getById: getByIdSpy,
            setCurrentProject: setCurrentProjectSpy,
            currentProject,
          },
        },
        {
          provide: Router,
          useValue: { createUrlTree: createUrlTreeSpy },
        },
      ],
    });
  });

  it('redirects to the dashboard when the id param is missing', async () => {
    createUrlTreeSpy.mockReturnValue('redirect:/');
    const result = await TestBed.runInInjectionContext(() =>
      projectExistsGuard(paramMap(null), {} as RouterStateSnapshot),
    );
    expect(createUrlTreeSpy).toHaveBeenCalledWith(['/']);
    expect(result).toBe('redirect:/');
    expect(setCurrentProjectSpy).not.toHaveBeenCalled();
  });

  it('redirects to the dashboard when the project does not exist', async () => {
    getByIdSpy.mockResolvedValue(undefined);
    createUrlTreeSpy.mockReturnValue('redirect:/');
    const result = await TestBed.runInInjectionContext(() =>
      projectExistsGuard(paramMap('missing-id'), {} as RouterStateSnapshot),
    );
    expect(getByIdSpy).toHaveBeenCalledWith('missing-id');
    expect(createUrlTreeSpy).toHaveBeenCalledWith(['/']);
    expect(result).toBe('redirect:/');
    expect(setCurrentProjectSpy).not.toHaveBeenCalled();
  });

  it('allows navigation and exposes the project when it exists', async () => {
    const project = { id: 'p1', name: 'Heroes' } as Project;
    getByIdSpy.mockResolvedValue(project);
    const result = await TestBed.runInInjectionContext(() =>
      projectExistsGuard(paramMap('p1'), {} as RouterStateSnapshot),
    );
    expect(result).toBe(true);
    expect(setCurrentProjectSpy).toHaveBeenCalledWith(project);
    expect(currentProject()).toBe(project);
  });
});
