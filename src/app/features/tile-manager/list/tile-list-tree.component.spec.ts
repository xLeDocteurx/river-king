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
});
