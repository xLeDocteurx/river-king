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
});
