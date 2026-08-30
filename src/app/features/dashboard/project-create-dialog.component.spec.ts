import 'fake-indexeddb/auto';
import { vi } from 'vitest';

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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ProjectCreateDialogComponent } from './project-create-dialog.component';
import { DatabaseService } from '../../core/services/database.service';
import { Project } from '../../shared/models/project.model';
import { ProjectService } from './services/project.service';

describe('ProjectCreateDialogComponent', () => {
  let fixture: ComponentFixture<ProjectCreateDialogComponent>;
  let navigateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectCreateDialogComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const db = TestBed.inject(DatabaseService);
    await db.projects.clear();

    fixture = TestBed.createComponent(ProjectCreateDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  function setName(value: string) {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('should create a project and navigate to it on submit', async () => {
    fixture.componentInstance.open();
    setName('My Game');

    await fixture.componentInstance.createProject(new Event('submit'));

    const projects = await TestBed.inject(ProjectService).getAll();
    expect(projects.length).toBe(1);
    expect(projects[0].name).toBe('My Game');
    expect(projects[0].palette.length).toBe(16);
    expect(projects[0].tileSize).toBe(16);
    expect(navigateSpy).toHaveBeenCalledWith(['/project', projects[0].id]);
  });

  it('should ignore submission when the name is blank', async () => {
    fixture.componentInstance.open();

    await fixture.componentInstance.createProject(new Event('submit'));

    const projects = await TestBed.inject(ProjectService).getAll();
    expect(projects.length).toBe(0);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('should reset the draft name when reopened', async () => {
    fixture.componentInstance.open();
    setName('Stale Name');

    fixture.componentInstance.open();

    expect(fixture.componentInstance.projectName()).toBe('');
  });

  it('preselects Sweetie 16 and resets on open', () => {
    fixture.componentInstance.open();
    expect(fixture.componentInstance.selectedPaletteId()).toBe('sweetie-16');

    fixture.componentInstance.selectPalette('nymph-gb');
    expect(fixture.componentInstance.selectedPaletteId()).toBe('nymph-gb');

    fixture.componentInstance.open();
    expect(fixture.componentInstance.selectedPaletteId()).toBe('sweetie-16');
  });

  it('highlights exactly the selected palette row', () => {
    fixture.componentInstance.open();
    fixture.componentInstance.selectPalette('nymph-gb');
    fixture.detectChanges();

    const rows = Array.from(
      fixture.nativeElement.querySelectorAll('button[role="radio"]'),
    ) as HTMLButtonElement[];
    const paletteRows = rows.filter((row) => row.querySelector('span'));
    const highlighted = paletteRows.filter((row) => row.className.includes('tw-border-accent'));

    expect(highlighted.length).toBe(1);
    const label = (highlighted[0] as HTMLElement).querySelector('span')?.textContent ?? '';
    expect(label.trim().startsWith('Nymph GB')).toBe(true);
  });

  it('creates the project with the chosen palette colors prefixed by #', async () => {
    const createSpy = vi
      .spyOn(TestBed.inject(ProjectService), 'create')
      .mockResolvedValue({ id: 'p1' } as Project);
    fixture.componentInstance.open();
    setName('Test');
    fixture.componentInstance.selectedPaletteId.set('nymph-gb');

    await fixture.componentInstance.createProject(new Event('submit'));

    const dto = createSpy.mock.calls[0][0];
    expect(dto.palette).toEqual(['#2c2137', '#446176', '#3fac95', '#a1ef8c']);
  });
});
