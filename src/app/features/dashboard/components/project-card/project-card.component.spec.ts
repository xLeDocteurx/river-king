import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { ProjectCardComponent } from './project-card.component';
import { DatabaseService } from '../../../../core/services/database.service';
import type { Project } from '../../../../shared/models/project.model';

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'test-project-1',
    name: 'Test Project',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    palette: ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8'],
    tileSize: 16,
    mapWidth: 40,
    mapHeight: 30,
    ...overrides,
  };
}

describe('ProjectCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectCardComponent],
    }).compileComponents();

    const db = TestBed.inject(DatabaseService);
    await db.projects.clear();
    await db.scenes.clear();
    await db.tiles.clear();
    await db.sprites.clear();
    await db.sessions.clear();
  });

  it('should render project name', async () => {
    const fixture = TestBed.createComponent(ProjectCardComponent);
    fixture.componentRef.setInput('project', createMockProject({ name: 'My Awesome Game' }));
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h3')?.textContent?.trim()).toBe('My Awesome Game');
  });

  it('should emit open with project id when open button clicked', async () => {
    const fixture = TestBed.createComponent(ProjectCardComponent);
    const project = createMockProject({ id: 'project-42' });
    fixture.componentRef.setInput('project', project);
    await fixture.whenStable();
    fixture.detectChanges();

    let emittedId: string | undefined;
    fixture.componentInstance.open.subscribe((id) => {
      emittedId = id;
    });

    const compiled = fixture.nativeElement as HTMLElement;
    const openButton = compiled.querySelector('button[title="Open"]');
    expect(openButton).toBeTruthy();
    openButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(emittedId).toBe('project-42');
  });

  it('should emit delete with project id when delete button clicked', async () => {
    const fixture = TestBed.createComponent(ProjectCardComponent);
    const project = createMockProject({ id: 'project-99' });
    fixture.componentRef.setInput('project', project);
    await fixture.whenStable();
    fixture.detectChanges();

    let emittedId: string | undefined;
    fixture.componentInstance.delete.subscribe((id) => {
      emittedId = id;
    });

    const compiled = fixture.nativeElement as HTMLElement;
    const deleteButton = compiled.querySelector('button[title="Delete"]');
    expect(deleteButton).toBeTruthy();
    deleteButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(emittedId).toBe('project-99');
  });

  it('should display palette colors', async () => {
    const fixture = TestBed.createComponent(ProjectCardComponent);
    const palette = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF', '#FFFFFF', '#000000'];
    fixture.componentRef.setInput('project', createMockProject({ palette }));
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const paletteContainer = compiled.querySelector('.tw-mt-3');
    expect(paletteContainer).toBeTruthy();
    const colorDivs = paletteContainer!.querySelectorAll('div');
    expect(colorDivs.length).toBe(8);

    for (let i = 0; i < 8; i++) {
      const div = colorDivs[i] as HTMLElement;
      expect(div.style.backgroundColor).toBe(hexToRgb(palette[i]));
    }
  });
});
