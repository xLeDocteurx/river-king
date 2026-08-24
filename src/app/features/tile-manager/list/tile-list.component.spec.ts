import { TestBed } from '@angular/core/testing';
import { TileListComponent } from './tile-list.component';
import type { Tile } from '../../../shared/models/tile.model';

function createMockTile(overrides: Partial<Tile> = {}): Tile {
  return {
    id: 1,
    projectId: 'proj-1',
    name: 'Test Tile',
    type: 'static',
    spriteIds: [],
    animationSpeed: 8,
    properties: {
      blocking: false,
      interactable: false,
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
    fixture.componentRef.setInput('tiles', [
      createMockTile({ id: 1, name: 'Grass' }),
      createMockTile({ id: 2, name: 'Water' }),
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const names = Array.from(compiled.querySelectorAll('button'))
      .filter((b) => !b.getAttribute('title'))
      .map((b) => b.textContent?.trim());
    expect(names).toHaveLength(2);
    expect(names[0]).toContain('Grass');
    expect(names[1]).toContain('Water');
  });

  it('should emit tileSelect when a tile is clicked', async () => {
    const fixture = TestBed.createComponent(TileListComponent);
    const tiles = [
      createMockTile({ id: 1, name: 'Grass' }),
      createMockTile({ id: 2, name: 'Water' }),
    ];
    fixture.componentRef.setInput('tiles', tiles);
    await fixture.whenStable();
    fixture.detectChanges();

    let selectedId: number | undefined;
    fixture.componentInstance.tileSelect.subscribe((id) => {
      selectedId = id;
    });

    const compiled = fixture.nativeElement as HTMLElement;
    const waterButton = Array.from(compiled.querySelectorAll('button')).find(
      (b) => !b.getAttribute('title') && b.textContent?.includes('Water'),
    );
    waterButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

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
    const tiles = [
      createMockTile({ id: 1, name: 'Grass' }),
      createMockTile({ id: 2, name: 'Water' }),
    ];
    fixture.componentRef.setInput('tiles', tiles);
    fixture.componentRef.setInput('selectedTileId', 2);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const [grassButton, waterButton] = Array.from(compiled.querySelectorAll('button')).filter(
      (b) => !b.getAttribute('title'),
    );

    expect(grassButton.classList.contains('tw-bg-primary/10')).toBe(false);
    expect(waterButton.classList.contains('tw-bg-primary/10')).toBe(true);
  });

  it('should render one light delete button per row', async () => {
    const fixture = TestBed.createComponent(TileListComponent);
    fixture.componentRef.setInput('tiles', [
      createMockTile({ id: 1, name: 'Grass' }),
      createMockTile({ id: 2, name: 'Water' }),
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const deleteButtons = compiled.querySelectorAll('button[title="Delete tile"]');
    expect(deleteButtons.length).toBe(2);
  });

  it('should emit tileDelete (not tileSelect) when the row delete button is clicked', async () => {
    const fixture = TestBed.createComponent(TileListComponent);
    fixture.componentRef.setInput('tiles', [
      createMockTile({ id: 1, name: 'Grass' }),
      createMockTile({ id: 2, name: 'Water' }),
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    let deletedId: number | undefined;
    let selectedId: number | undefined;
    fixture.componentInstance.tileDelete.subscribe((id) => {
      deletedId = id;
    });
    fixture.componentInstance.tileSelect.subscribe((id) => {
      selectedId = id;
    });

    const compiled = fixture.nativeElement as HTMLElement;
    const grassDelete = compiled.querySelector('button[title="Delete tile"]') as HTMLButtonElement;
    grassDelete.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(deletedId).toBe(1);
    expect(selectedId).toBeUndefined();
  });
});
