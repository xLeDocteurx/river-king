import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import 'fake-indexeddb/auto';
import { DashboardComponent } from './dashboard.component';
import { ProjectCreateDialogComponent } from './project-create-dialog.component';

if (!('showModal' in HTMLDialogElement.prototype)) {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    value: vi.fn(),
    writable: true,
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    value: vi.fn(),
    writable: true,
  });
}
import { DatabaseService } from '../../core/services/database.service';
import type { Project } from '../../shared/models/project.model';

function makeProject(id: string): Project {
  return {
    id,
    name: `Project ${id}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    palette: ['#000000'],
    tileSize: 16,
    mapWidth: 40,
    mapHeight: 30,
  };
}

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let db: DatabaseService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    db = TestBed.inject(DatabaseService);
    await db.projects.clear();
    await db.scenes.clear();
    await db.tiles.clear();
    await db.sprites.clear();
    await db.sessions.clear();
  });

  async function mountWithProjects(projects: Project[]): Promise<void> {
    await db.projects.bulkAdd(projects);
    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();
  }

  it('should display the My Projects header label', async () => {
    await mountWithProjects([]);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="dashboard-title"]')?.textContent?.trim()).toBe(
      'My Projects',
    );
  });

  it('should pluralize the project count in the status bar', async () => {
    await mountWithProjects([makeProject('a'), makeProject('b'), makeProject('c')]);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="status-count"]')?.textContent?.trim()).toBe(
      '3 projects',
    );
  });

  it('should use singular wording for a single project', async () => {
    await mountWithProjects([makeProject('only')]);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="status-count"]')?.textContent?.trim()).toBe(
      '1 project',
    );
  });

  it('should render one card per project', async () => {
    await mountWithProjects([makeProject('a'), makeProject('b')]);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('rk-project-card').length).toBe(2);
  });

  function createDialogSpy(): ReturnType<typeof vi.fn> {
    const dialogEl = fixture.debugElement.query(By.directive(ProjectCreateDialogComponent))
      .componentInstance as ProjectCreateDialogComponent;
    return vi.spyOn(dialogEl, 'open');
  }

  it('should open the create dialog from the dashed row', async () => {
    await mountWithProjects([makeProject('a')]);
    const openSpy = createDialogSpy();

    const compiled = fixture.nativeElement as HTMLElement;
    const dashed = compiled.querySelector<HTMLElement>('[data-testid="new-project-dashed"]');
    expect(dashed).toBeTruthy();
    dashed!.click();
    await new Promise((r) => setTimeout(r, 50));

    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('should offer the dashed CTA in the empty state and open the dialog', async () => {
    await mountWithProjects([]);
    const openSpy = createDialogSpy();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No projects yet');
    const cta = compiled.querySelector<HTMLElement>('[data-testid="new-project-empty"]');
    expect(cta).toBeTruthy();
    cta!.click();
    await new Promise((r) => setTimeout(r, 50));

    expect(openSpy).toHaveBeenCalledTimes(1);
  });
});
