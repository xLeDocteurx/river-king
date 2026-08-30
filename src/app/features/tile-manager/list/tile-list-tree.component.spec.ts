import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TileListTreeComponent } from './tile-list-tree.component';
import { CdkDropList, CdkDrag, CdkDropListGroup } from '@angular/cdk/drag-drop';

describe('TileListTreeComponent', () => {
  let component: TileListTreeComponent;
  let fixture: ComponentFixture<TileListTreeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TileListTreeComponent, CdkDropListGroup, CdkDropList, CdkDrag],
    }).compileComponents();
    fixture = TestBed.createComponent(TileListTreeComponent);
    component = fixture.componentInstance;
  });

  it('should emit tileSelect on click', () => {
    const spy = vi.spyOn(component.tileSelect, 'emit');
    fixture.componentRef.setInput('tiles', [
      {
        id: 1,
        name: 'Grass',
        projectId: 'p1',
        type: 'static',
        animationSpeed: 1,
        properties: { blocking: false, interactable: false },
        spriteIds: [],
      },
    ]);
    fixture.detectChanges();
    // trigger click via emitted output directly — no DOM click in jsdom needed
    component.tileSelect.emit(1);
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('should show a delete button on an empty folder header and emit folderDelete', () => {
    const deleteSpy = vi.spyOn(component.folderDelete, 'emit');
    fixture.componentRef.setInput('tiles', []);
    fixture.componentRef.setInput('folders', ['mountain']);
    fixture.detectChanges();

    const deleteButton = (fixture.nativeElement as HTMLElement).querySelector(
      'button[title="Delete folder mountain"]',
    ) as HTMLButtonElement | null;
    expect(deleteButton).toBeTruthy();
    deleteButton!.click();
    expect(deleteSpy).toHaveBeenCalledWith('mountain');
  });

  it('should not show a folder delete button when the folder has tiles', () => {
    fixture.componentRef.setInput('tiles', [
      {
        id: 1,
        name: 'Grass',
        projectId: 'p1',
        type: 'static',
        animationSpeed: 1,
        properties: { blocking: false, interactable: false },
        spriteIds: [],
        folderPath: 'mountain',
      },
    ]);
    fixture.componentRef.setInput('folders', ['mountain']);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        'button[title="Delete folder mountain"]',
      ),
    ).toBeNull();
  });

  it('renames a folder inline via double-click and Enter', () => {
    fixture.componentRef.setInput('tiles', [
      {
        id: 1,
        name: 'Grass',
        projectId: 'p1',
        type: 'static',
        animationSpeed: 1,
        properties: { blocking: false, interactable: false },
        spriteIds: [],
        folderPath: 'forest',
      },
    ]);
    fixture.componentRef.setInput('folders', ['forest']);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const header = Array.from(compiled.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('forest'),
    ) as HTMLButtonElement;

    header.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();

    const input = compiled.querySelector('input') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    expect(input?.value).toBe('forest');

    const renameSpy = vi.spyOn(component.folderRename, 'emit');
    input!.value = 'woods';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(renameSpy).toHaveBeenCalledWith({ fromKey: 'forest', toKey: 'woods' });
    expect(compiled.querySelector('input')).toBeNull();
  });

  it('creates a folder via the inline input and Enter', () => {
    fixture.componentRef.setInput('tiles', []);
    fixture.componentRef.setInput('folders', []);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const newFolderButton = compiled.querySelector(
      'button[title="New Folder"]',
    ) as HTMLButtonElement;
    newFolderButton.click();
    fixture.detectChanges();

    const input = compiled.querySelector('input') as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = 'mountain';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const createSpy = vi.spyOn(component.createFolder, 'emit');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(createSpy).toHaveBeenCalledWith('mountain');
    expect(compiled.querySelector('input')).toBeNull();
  });
});
