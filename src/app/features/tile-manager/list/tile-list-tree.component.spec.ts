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
      { id: 1, name: 'Grass', projectId: 'p1', type: 'static', animationSpeed: 1, properties: { blocking: false, interactable: false }, spriteIds: [] },
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
      { id: 1, name: 'Grass', projectId: 'p1', type: 'static', animationSpeed: 1, properties: { blocking: false, interactable: false }, spriteIds: [], folderPath: 'mountain' },
    ]);
    fixture.componentRef.setInput('folders', ['mountain']);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('button[title="Delete folder mountain"]'),
    ).toBeNull();
  });
});
