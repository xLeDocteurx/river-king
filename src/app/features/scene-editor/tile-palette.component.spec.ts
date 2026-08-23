import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TilePaletteComponent } from './tile-palette.component';
import type { Tile } from '../../shared/models/tile.model';

function makeTile(id: number, name: string): Tile {
  return {
    id,
    projectId: 'proj-1',
    name,
    type: 'static',
    spriteIds: [],
    animationSpeed: 8,
    properties: { blocking: false, interactable: false },
  };
}

describe('TilePaletteComponent', () => {
  let fixture: ComponentFixture<TilePaletteComponent>;

  function setup(
    tiles: Tile[],
    tileImages: Record<number, string>,
  ): ComponentFixture<TilePaletteComponent> {
    TestBed.configureTestingModule({ imports: [TilePaletteComponent] });
    fixture = TestBed.createComponent(TilePaletteComponent);
    fixture.componentRef.setInput('tiles', tiles);
    fixture.componentRef.setInput('tileImages', tileImages);
    fixture.detectChanges();
    return fixture;
  }

  it('renders an image preview when a tile image exists', () => {
    const compiled = setup([makeTile(1, 'Water')], { 1: 'data:image/png;base64,IMG' })
      .nativeElement as HTMLElement;

    const img = compiled.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('data:image/png;base64,IMG');
  });

  it('keeps a plain colored button when no tile image exists', () => {
    const compiled = setup([makeTile(2, 'Void')], {}).nativeElement as HTMLElement;

    expect(compiled.querySelector('img')).toBeNull();
  });

  it('emits tileSelect with the tile id when a tile showing an image preview is clicked', () => {
    const fixtureRef = setup([makeTile(1, 'Water')], { 1: 'data:image/png;base64,IMG' });
    const spy = vi.fn();
    fixtureRef.componentInstance.tileSelect.subscribe(spy);

    const button = (fixtureRef.nativeElement as HTMLElement).querySelector(
      'button',
    ) as HTMLButtonElement;
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(spy).toHaveBeenCalledWith(1);
  });
});
