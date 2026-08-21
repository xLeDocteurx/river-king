import { TestBed } from '@angular/core/testing';
import { TilePropertiesComponent } from './tile-properties.component';
import type { Tile } from '../../shared/models/tile.model';

function createMockTile(overrides: Partial<Tile> = {}): Tile {
  return {
    id: 1,
    projectId: 'proj-1',
    name: 'Test Tile',
    type: 'static',
    spriteIds: [],
    animationSpeed: 8,
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

describe('TilePropertiesComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TilePropertiesComponent],
    }).compileComponents();
  });

  it('should render form fields with tile values', async () => {
    const fixture = TestBed.createComponent(TilePropertiesComponent);
    const tile = createMockTile({ name: 'Grass', type: 'animated', animationSpeed: 12 });
    fixture.componentRef.setInput('tile', tile);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const nameInput = compiled.querySelector('input[name="name"]') as HTMLInputElement;
    expect(nameInput).toBeTruthy();
    expect(nameInput.value).toBe('Grass');
  });

  it('should emit save with updated tile data', async () => {
    const fixture = TestBed.createComponent(TilePropertiesComponent);
    const tile = createMockTile({ id: 42 });
    fixture.componentRef.setInput('tile', tile);
    await fixture.whenStable();
    fixture.detectChanges();

    let savedTile: Tile | undefined;
    fixture.componentInstance.save.subscribe((t) => {
      savedTile = t;
    });

    const compiled = fixture.nativeElement as HTMLElement;
    const nameInput = compiled.querySelector('input[name="name"]') as HTMLInputElement;
    nameInput.value = 'Updated Tile';
    nameInput.dispatchEvent(new Event('input'));

    const form = compiled.querySelector('form');
    expect(form).toBeTruthy();
    form!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(savedTile).toBeTruthy();
    expect(savedTile!.name).toBe('Updated Tile');
    expect(savedTile!.id).toBe(42);
  });

  it('should emit delete with tile id when delete button clicked', async () => {
    const fixture = TestBed.createComponent(TilePropertiesComponent);
    const tile = createMockTile({ id: 99 });
    fixture.componentRef.setInput('tile', tile);
    await fixture.whenStable();
    fixture.detectChanges();

    let deletedId: number | undefined;
    fixture.componentInstance.delete.subscribe((id) => {
      deletedId = id;
    });

    const compiled = fixture.nativeElement as HTMLElement;
    const deleteButton = compiled.querySelector('button[type="button"]') as HTMLButtonElement;
    expect(deleteButton).toBeTruthy();
    deleteButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(deletedId).toBe(99);
  });
});
