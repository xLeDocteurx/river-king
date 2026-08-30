import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SceneListComponent } from './scene-list.component';
import type { Scene } from '../../shared/models/scene.model';

describe('SceneListComponent', () => {
  let fixture: ComponentFixture<SceneListComponent>;
  let component: SceneListComponent;

  const makeScene = (id: string, name: string, folderPath = ''): Scene => ({
    id,
    projectId: 'p1',
    name,
    folderPath,
    width: 10,
    height: 10,
    layers: [
      {
        id: 'layer-default',
        name: 'Background',
        visible: true,
        opacity: 1,
        tileData: [],
      },
    ],
  });

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
      makeScene('s1', 'Forest 1', 'forest'),
      makeScene('s2', 'Forest 2', 'forest'),
      makeScene('s3', 'Cave 1', 'caves'),
      makeScene('s4', 'Untitled'),
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

  it('should render persisted folders even when they contain no scene', () => {
    fixture.componentRef.setInput('scenes', [makeScene('s1', 'Untitled')]);
    fixture.componentRef.setInput('folders', ['mountain']);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('mountain');
    const dropLists = compiled.querySelectorAll('[cdkDropList]');
    expect(dropLists.length).toBe(2); // Ungrouped + mountain
  });

  it('should collapse and expand a folder when its header is clicked', () => {
    const scenes: Scene[] = [
      makeScene('s1', 'Forest 1', 'forest'),
      makeScene('s2', 'Cave 1', 'caves'),
    ];
    fixture.componentRef.setInput('scenes', scenes);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const headerFor = (path: string) =>
      Array.from(compiled.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(path),
      ) as HTMLButtonElement;

    headerFor('forest')!.click();
    fixture.detectChanges();
    expect(compiled.textContent).not.toContain('Forest 1');
    expect(compiled.textContent).toContain('Cave 1');
    expect(compiled.querySelectorAll('[cdkDropList]').length).toBe(1);

    headerFor('forest')!.click();
    fixture.detectChanges();
    expect(compiled.textContent).toContain('Forest 1');
    expect(compiled.querySelectorAll('[cdkDropList]').length).toBe(2);
  });

  it('should show a delete button on an empty folder header', () => {
    fixture.componentRef.setInput('scenes', [makeScene('s1', 'Untitled')]);
    fixture.componentRef.setInput('folders', ['mountain']);
    fixture.detectChanges();

    const deleteButton = (fixture.nativeElement as HTMLElement).querySelector(
      'button[title="Delete folder mountain"]',
    );
    expect(deleteButton).toBeTruthy();
  });

  it('should not show a folder delete button when the folder has scenes', () => {
    fixture.componentRef.setInput('scenes', [makeScene('s1', 'Mountain Path', 'mountain')]);
    fixture.componentRef.setInput('folders', ['mountain']);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('button[title="Delete folder mountain"]'),
    ).toBeNull();
  });

  it('should not show a folder delete button on the ungrouped header', () => {
    fixture.componentRef.setInput('scenes', [makeScene('s1', 'Untitled')]);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('button[title^="Delete folder"]'),
    ).toBeNull();
  });

  it('should emit folderDelete when an empty folder delete button is clicked', () => {
    fixture.componentRef.setInput('scenes', []);
    fixture.componentRef.setInput('folders', ['mountain']);
    fixture.detectChanges();

    const deleteSpy = vi.spyOn(component.folderDelete, 'emit');
    const deleteButton = (fixture.nativeElement as HTMLElement).querySelector(
      'button[title="Delete folder mountain"]',
    ) as HTMLButtonElement;
    deleteButton.click();
    expect(deleteSpy).toHaveBeenCalledWith('mountain');
  });

  it('should emit createFolder when onCreateGroup is invoked', () => {
    fixture.componentRef.setInput('scenes', []);
    fixture.detectChanges();

    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('mountain');
    const createSpy = vi.spyOn(component.createFolder, 'emit');

    component.onCreateGroup();

    expect(createSpy).toHaveBeenCalledOnce();
    expect(createSpy).toHaveBeenCalledWith('mountain');
    promptSpy.mockRestore();
  });

  it('should not emit createFolder for a name that already exists in folders input', () => {
    fixture.componentRef.setInput('scenes', []);
    fixture.componentRef.setInput('folders', ['mountain']);
    fixture.detectChanges();

    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('mountain');
    const createSpy = vi.spyOn(component.createFolder, 'emit');

    component.onCreateGroup();

    expect(createSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('should not emit createFolder for a name that exists as a scene folderPath', () => {
    fixture.componentRef.setInput('scenes', [makeScene('s1', 'A', 'forest')]);
    fixture.detectChanges();

    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('forest');
    const createSpy = vi.spyOn(component.createFolder, 'emit');

    component.onCreateGroup();

    expect(createSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('should give every drop list a minimum height so empty folders accept drops', () => {
    fixture.componentRef.setInput('scenes', []);
    fixture.componentRef.setInput('folders', ['mountain']);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const dropLists = compiled.querySelectorAll('[cdkDropList]');
    expect(dropLists.length).toBeGreaterThan(0);
    dropLists.forEach((list) => {
      expect(list.className).toContain('tw-min-h-[2.5rem]');
    });
  });

  it('should not use the bare tw-transition class on draggable items', () => {
    fixture.componentRef.setInput('scenes', [makeScene('s1', 'Draggable')]);
    fixture.detectChanges();

    const dragItems = (fixture.nativeElement as HTMLElement).querySelectorAll('[cdkDrag]');
    expect(dragItems.length).toBe(1);
    const rowButton = dragItems[0].querySelector('button');
    // CDK clones the cdkDrag root as preview; a bare multi-property transition on it crashes
    // CDK's transition parser (transition-property vs transition-duration list mismatch).
    expect(dragItems[0].className).not.toMatch(/\btw-transition\b/);
    expect(rowButton?.className).toContain('tw-transition-colors');
  });

  it('should emit sceneSelect when a scene button is clicked', () => {
    fixture.componentRef.setInput('scenes', [makeScene('s1', 'Scene A')]);
    fixture.detectChanges();

    const selectSpy = vi.spyOn(component.sceneSelect, 'emit');
    const button = fixture.nativeElement.querySelector(
      '.cdk-drop-list button',
    ) as HTMLButtonElement;
    button.click();
    expect(selectSpy).toHaveBeenCalledWith('s1');
  });

  it('should emit createScene when the add button is clicked', () => {
    fixture.componentRef.setInput('scenes', []);
    fixture.detectChanges();

    const createSpy = vi.spyOn(component.createScene, 'emit');
    const addButton = (fixture.nativeElement as HTMLElement).querySelector(
      'button[title="New Scene"]',
    ) as HTMLButtonElement;
    addButton.click();
    expect(createSpy).toHaveBeenCalled();
  });

  it('should emit sceneDelete with the scene id when the delete button is clicked', () => {
    fixture.componentRef.setInput('scenes', [makeScene('s1', 'Doomed')]);
    fixture.detectChanges();

    const deleteSpy = vi.spyOn(component.sceneDelete, 'emit');
    const selectSpy = vi.spyOn(component.sceneSelect, 'emit');
    const deleteButton = (fixture.nativeElement as HTMLElement).querySelector(
      'button[title^="Delete"]',
    ) as HTMLButtonElement;
    deleteButton.click();
    expect(deleteSpy).toHaveBeenCalledWith('s1');
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it('should emit sceneFolderChange when a scene is moved to a different group', () => {
    const scenes: Scene[] = [makeScene('s1', 'Scene A', 'old')];
    fixture.componentRef.setInput('scenes', scenes);
    fixture.detectChanges();

    const changeSpy = vi.spyOn(component.sceneFolderChange, 'emit');
    component.onSceneFolderChange({ itemId: 's1', groupKey: 'new' });
    expect(changeSpy).toHaveBeenCalledWith({ sceneId: 's1', folderPath: 'new' });
  });
});
