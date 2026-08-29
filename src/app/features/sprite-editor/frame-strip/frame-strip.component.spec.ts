import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FrameStripComponent } from './frame-strip.component';
import type { Sprite } from '../../../shared/models/sprite.model';
import type { Tile } from '../../../shared/models/tile.model';

describe('FrameStripComponent', () => {
  let fixture: ComponentFixture<FrameStripComponent>;
  let component: FrameStripComponent;

  const makeTile = (): Tile => ({
    id: 1,
    projectId: 'p1',
    name: 'Test tile',
    type: 'static',
    animationSpeed: 4,
    properties: { blocking: false, interactable: false },
    spriteIds: [1, 2, 3],
  });

  const makeSprite = (id: number): Sprite => ({
    id,
    projectId: 'p1',
    tileId: 1,
    name: `Frame ${id}`,
    width: 16,
    height: 16,
    pixelData: `data:image/png;base64,frame${id}`,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FrameStripComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FrameStripComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('tile', makeTile());
  });

  it('renders one item per frames input', () => {
    fixture.componentRef.setInput('frames', [makeSprite(1), makeSprite(2), makeSprite(3)]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('[cdkDrag]').length).toBe(3);
    expect(compiled.querySelectorAll('[cdkDropList]').length).toBe(1);
  });

  it('emits frameSelect when a frame is clicked', () => {
    fixture.componentRef.setInput('frames', [makeSprite(1), makeSprite(2)]);
    fixture.detectChanges();

    const selectSpy = vi.spyOn(component.frameSelect, 'emit');
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelectorAll('[cdkDrag]')[1] as HTMLElement).click();
    expect(selectSpy).toHaveBeenCalledWith(2);
  });

  it('emits frameReorder when dropped on a different index', () => {
    const frames = [makeSprite(1), makeSprite(2), makeSprite(3)];
    fixture.componentRef.setInput('frames', frames);
    fixture.detectChanges();

    const reorderSpy = vi.spyOn(component.frameReorder, 'emit');
    component.onDropped({
      previousIndex: 0,
      currentIndex: 2,
    } as unknown as import('@angular/cdk/drag-drop').CdkDragDrop<Sprite[]>);
    expect(reorderSpy).toHaveBeenCalledWith([0, 2]);
  });

  it('does not emit frameReorder when dropped on the same index', () => {
    const frames = [makeSprite(1), makeSprite(2), makeSprite(3)];
    fixture.componentRef.setInput('frames', frames);
    fixture.detectChanges();

    const reorderSpy = vi.spyOn(component.frameReorder, 'emit');
    component.onDropped({
      previousIndex: 1,
      currentIndex: 1,
    } as unknown as import('@angular/cdk/drag-drop').CdkDragDrop<Sprite[]>);
    expect(reorderSpy).not.toHaveBeenCalled();
  });
});
