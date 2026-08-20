import { TestBed } from '@angular/core/testing';
import { TileListComponent } from './tile-list.component';
import type { Tile } from '../../../../shared/models/tile.model';

function createMockTile(overrides: Partial<Tile> = {}): Tile {
  return {
    id: 1,
    projectId: 'proj-1',
    name: 'Test Tile',
    type: 'static',
    spriteIds: [],
    animationSpeed: 200,
    properties: {
      collision: false,
      solid: false,
      interactable: false,
      layer: 'background',
      ...overrides.properties,
    },
    ...overrides,
  };
}

describe('TileListComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TileListComponent],
    }).compileComponents();
  });

  it('should render tile names', async () => {
    const fixture = TestBed.createComponent(TileListComponent);
    fixture.componentRef.setInput('tiles', [createMockTile({ id: 1, name: 'Grass' }), createMockTile({ id: 2, name: 'Water' })]);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('button[type="button"]');
    // first button is the add button, then the tiles
    expect(buttons.length).toBe(3);
    expect(buttons[1].textContent?.trim()).toContain('Grass');
    expect(buttons[2].textContent?.trim()).toContain('Water');
  });

  it('should emit tileSelect when a tile is clicked', async () => {
    const fixture = TestBed.createComponent(TileListComponent);
    const tiles = [createMockTile({ id: 1, name: 'Grass' }), createMockTile({ id: 2, name: 'Water' })];
    fixture.componentRef.setInput('tiles', tiles);
    await fixture.whenStable();
    fixture.detectChanges();

    let selectedId: number | undefined;
    fixture.componentInstance.tileSelect.subscribe((id) => {
      selectedId = id;
    });

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('button[type="button"]');
    buttons[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(selectedId).toBe(2);
  });

  it('should emit tileCreate when add button is clicked', async () => {
    const fixture = TestBed.createComponent(TileListComponent);
    fixture.componentRef.setInput('tiles', []);
    await fixture.whenStable();
    fixture.detectChanges();

    let emitted = false;
    fixture.componentInstance.tileCreate.subscribe(() => {
      emitted = true;
    });

    const compiled = fixture.nativeElement as HTMLElement;
    const addButton = compiled.querySelector('button[title="New Tile"]');
    expect(addButton).toBeTruthy();
    addButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(emitted).toBe(true);
  });

  it('should show empty message when no tiles', async () => {
    const fixture = TestBed.createComponent(TileListComponent);
    fixture.componentRef.setInput('tiles', []);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No tiles yet');
  });

  it('should highlight selected tile', async () => {
    const fixture = TestBed.createComponent(TileListComponent);
    const tiles = [createMockTile({ id: 1, name: 'Grass' }), createMockTile({ id: 2, name: 'Water' })];
    fixture.componentRef.setInput('tiles', tiles);
    fixture.componentRef.setInput('selectedTileId', 2);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('button[type="button"]');
    const grassButton = buttons[1];
    const waterButton = buttons[2];

    expect(grassButton.classList.contains('tw-bg-primary/10')).toBe(false);
    expect(waterButton.classList.contains('tw-bg-primary/10')).toBe(true);
  });
});
