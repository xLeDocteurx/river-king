import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SceneListComponent } from './scene-list.component';
import type { Scene } from '../../../../shared/models/scene.model';

describe('SceneListComponent', () => {
  let fixture: ComponentFixture<SceneListComponent>;
  let component: SceneListComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SceneListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SceneListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('scenes', []);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render scenes grouped by folderPath', () => {
    const scenes: Scene[] = [
      { id: 's1', projectId: 'p1', name: 'Forest 1', folderPath: 'forest', width: 10, height: 10, tileData: [] },
      { id: 's2', projectId: 'p1', name: 'Forest 2', folderPath: 'forest', width: 10, height: 10, tileData: [] },
      { id: 's3', projectId: 'p1', name: 'Cave 1', folderPath: 'caves', width: 10, height: 10, tileData: [] },
      { id: 's4', projectId: 'p1', name: 'Untitled', folderPath: '', width: 10, height: 10, tileData: [] },
    ];
    fixture.componentRef.setInput('scenes', scenes);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('forest');
    expect(compiled.textContent).toContain('caves');
    expect(compiled.textContent).toContain('Ungrouped');
    expect(compiled.textContent).toContain('Forest 1');
    expect(compiled.textContent).toContain('Forest 2');
    expect(compiled.textContent).toContain('Cave 1');
    expect(compiled.textContent).toContain('Untitled');
  });

  it('should emit sceneSelect when a scene button is clicked', () => {
    const scenes: Scene[] = [
      { id: 's1', projectId: 'p1', name: 'Scene A', folderPath: '', width: 10, height: 10, tileData: [] },
    ];
    fixture.componentRef.setInput('scenes', scenes);
    fixture.detectChanges();

    const selectSpy = vi.spyOn(component.sceneSelect, 'emit');
    const button = fixture.nativeElement.querySelector('button[cdkDrag]') as HTMLButtonElement;
    button.click();
    expect(selectSpy).toHaveBeenCalledWith('s1');
  });

  it('should emit createScene when the add button is clicked', () => {
    fixture.componentRef.setInput('scenes', []);
    fixture.detectChanges();

    const createSpy = vi.spyOn(component.createScene, 'emit');
    const addButton = (fixture.nativeElement as HTMLElement).querySelector('button[title="New Scene"]') as HTMLButtonElement;
    addButton.click();
    expect(createSpy).toHaveBeenCalled();
  });

  it('should add a custom group when onCreateGroup is invoked', () => {
    fixture.componentRef.setInput('scenes', []);
    fixture.detectChanges();

    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('mountain');
    component.onCreateGroup();
    expect(component.groups().some((g) => g.folderPath === 'mountain')).toBe(true);
    promptSpy.mockRestore();
  });

  it('should emit sceneFolderChange when a scene is dropped in a different group', () => {
    const scenes: Scene[] = [
      { id: 's1', projectId: 'p1', name: 'Scene A', folderPath: 'old', width: 10, height: 10, tileData: [] },
    ];
    fixture.componentRef.setInput('scenes', scenes);
    fixture.detectChanges();

    const changeSpy = vi.spyOn(component.sceneFolderChange, 'emit');
    const dragEvent = {
      previousContainer: { data: scenes },
      container: { data: [] as Scene[] },
      item: { data: scenes[0] },
    } as unknown as import('@angular/cdk/drag-drop').CdkDragDrop<Scene[]>;

    component.onDrop(dragEvent, 'new');
    expect(changeSpy).toHaveBeenCalledWith({ sceneId: 's1', folderPath: 'new' });
  });
});
