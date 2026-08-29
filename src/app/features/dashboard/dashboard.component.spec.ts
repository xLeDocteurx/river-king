import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import 'fake-indexeddb/auto';
import { DashboardComponent } from './dashboard.component';
import { ProjectCreateDialogComponent } from './project-create-dialog.component';
import { ImportProjectDialogComponent } from './import-project-dialog/import-project-dialog.component';

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
import { NotificationService } from '../../core/services/notification.service';
import { ProjectIoService } from '../../core/services/project-io.service';
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

const minimalArchiveJson = JSON.stringify({
  format: 'river-king-project',
  formatVersion: 1,
  exportedAt: 0,
  project: { name: 'Imported', palette: ['#000000'], tileSize: 16, mapWidth: 40, mapHeight: 30 },
  tiles: [],
  sprites: [],
  scenes: [],
  folders: [],
});

async function selectFile(compiled: HTMLElement, content: string): Promise<void> {
  const input = compiled.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).toBeTruthy();
  Object.defineProperty(input!, 'files', {
    value: [new File([content], 'archive.rkproj', { type: 'application/json' })],
    configurable: true,
  });
  input!.dispatchEvent(new Event('change'));
  await new Promise((r) => setTimeout(r, 50));
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

  it('should pluralize the project count label', async () => {
    await mountWithProjects([makeProject('a'), makeProject('b'), makeProject('c')]);
    expect(fixture.componentInstance.countLabel(3)).toBe('3 projects');
  });

  it('should use singular wording for a single project', async () => {
    await mountWithProjects([makeProject('only')]);
    expect(fixture.componentInstance.countLabel(1)).toBe('1 project');
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

  it('should offer an import button that opens the file picker', async () => {
    await mountWithProjects([]);
    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector<HTMLElement>('[data-testid="import-project"]');
    expect(button).toBeTruthy();
    expect(button?.textContent).toContain('Import');
  });

  it('should stage a valid file and open the import dialog', async () => {
    await mountWithProjects([makeProject('a')]);
    const openSpy = vi
      .spyOn(
        fixture.debugElement.query(By.directive(ImportProjectDialogComponent))
          .componentInstance as ImportProjectDialogComponent,
        'open',
      )
      .mockImplementation(() => {});

    const compiled = fixture.nativeElement as HTMLElement;
    await selectFile(compiled, minimalArchiveJson);
    fixture.detectChanges();

    expect(fixture.componentInstance.pendingImport()).not.toBeNull();
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('should reject unreadable files with a notification', async () => {
    await mountWithProjects([]);
    const errorSpy = vi.spyOn(TestBed.inject(NotificationService), 'error');
    const openSpy = vi
      .spyOn(
        fixture.debugElement.query(By.directive(ImportProjectDialogComponent))
          .componentInstance as ImportProjectDialogComponent,
        'open',
      )
      .mockImplementation(() => {});

    const compiled = fixture.nativeElement as HTMLElement;
    await selectFile(compiled, '{not json');
    fixture.detectChanges();

    expect(errorSpy).toHaveBeenCalledWith('This file is not a valid project file.');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('should import the staged file, notify, and navigate to the new project', async () => {
    await mountWithProjects([]);
    const importSpy = vi
      .spyOn(TestBed.inject(ProjectIoService), 'importProject')
      .mockResolvedValue({ projectId: 'fresh-1', kind: 'new' });
    const successSpy = vi.spyOn(TestBed.inject(NotificationService), 'success');
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const compiled = fixture.nativeElement as HTMLElement;
    await selectFile(compiled, minimalArchiveJson);

    await fixture.componentInstance.importProjectFromFile({ kind: 'new' });

    expect(importSpy).toHaveBeenCalledWith(minimalArchiveJson, { kind: 'new' });
    expect(successSpy).toHaveBeenCalledWith('Project imported');
    expect(navigateSpy).toHaveBeenCalledWith(['/project', 'fresh-1']);
    expect(fixture.componentInstance.pendingImport()).toBeNull();
  });
});
