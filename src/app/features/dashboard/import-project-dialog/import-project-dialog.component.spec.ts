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
import { By } from '@angular/platform-browser';
import { ImportProjectDialogComponent } from './import-project-dialog.component';
import { ProjectArchive } from '../../../shared/models/project-archive.model';
import { Project } from '../../../shared/models/project.model';

describe('ImportProjectDialogComponent', () => {
  let fixture: ComponentFixture<ImportProjectDialogComponent>;

  function makeArchive(): ProjectArchive {
    return {
      format: 'river-king-project',
      formatVersion: 1,
      exportedAt: 0,
      project: { name: 'Heroes', palette: ['#ff0000', '#00ff00'], tileSize: 16, mapWidth: 40, mapHeight: 30 },
      tiles: [
        {
          sourceId: 1,
          name: 'Ground',
          type: 'static',
          spriteIds: [11],
          animationSpeed: 4,
          properties: { blocking: false, interactable: false },
          folderPath: '',
        },
        {
          sourceId: 2,
          name: 'Water',
          type: 'static',
          spriteIds: [21, 22],
          animationSpeed: 4,
          properties: { blocking: true, interactable: false },
          folderPath: '',
        },
      ],
      sprites: [
        {
          sourceId: 11,
          tileSourceId: 1,
          name: 'g',
          width: 16,
          height: 16,
          pixelData: 'data:image/png;base64,AAA',
        },
        {
          sourceId: 21,
          tileSourceId: 2,
          name: 'w1',
          width: 16,
          height: 16,
          pixelData: 'data:image/png;base64,BBB',
        },
        {
          sourceId: 22,
          tileSourceId: 2,
          name: 'w2',
          width: 16,
          height: 16,
          pixelData: 'data:image/png;base64,CCC',
        },
      ],
      scenes: [{ name: 'Level 1', folderPath: '', width: 10, height: 10, layers: [] }],
      folders: ['nature'],
    };
  }

  function makeProject(id: string, name: string): Project {
    return {
      id,
      name,
      createdAt: 1,
      updatedAt: 2,
      palette: ['#000000'],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportProjectDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportProjectDialogComponent);
    fixture.componentRef.setInput('archive', makeArchive());
    fixture.componentRef.setInput('projects', [makeProject('p1', 'Alpha'), makeProject('p2', 'Beta')]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.open();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function clickButton(label: string): void {
    const buttons = fixture.debugElement.queryAll(By.css('button'));
    const button = buttons.find((b) => b.nativeElement.textContent.trim() === label);
    expect(button).toBeTruthy();
    button!.nativeElement.click();
    fixture.detectChanges();
  }

  it('summarizes the archive contents', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Heroes');
    expect(host.textContent).toContain('2 tiles');
    expect(host.textContent).toContain('3 frames');
    expect(host.textContent).toContain('1 scenes');
    expect(host.textContent).toContain('2-color palette');
  });

  it('emits a new-project import mode by default', () => {
    const confirmed = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);

    clickButton('Import');

    expect(confirmed).toHaveBeenCalledWith({ kind: 'new' });
  });

  it('emits a replace import mode once a project is selected', () => {
    const confirmed = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);

    const select = fixture.nativeElement.querySelector(
      'select[aria-label="Project to replace"]',
    ) as HTMLSelectElement;
    select.value = 'p2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    clickButton('Replace an existing project');
    clickButton('Import');

    expect(confirmed).toHaveBeenCalledWith({ kind: 'replace', targetProjectId: 'p2' });
  });

  it('disables import when replacing without a selected project', () => {
    clickButton('Replace an existing project');

    const buttons = fixture.debugElement.queryAll(By.css('button'));
    const importButton = buttons.find((b) => b.nativeElement.textContent.trim() === 'Import')!;
    expect(importButton.nativeElement.disabled).toBe(true);
  });

  it('does not confirm when the cancel button is clicked', () => {
    const confirmed = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);

    clickButton('Cancel');

    expect(confirmed).not.toHaveBeenCalled();
  });
});