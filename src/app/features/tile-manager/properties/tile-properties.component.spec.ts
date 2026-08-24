import 'fake-indexeddb/auto';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { TilePropertiesComponent } from './tile-properties.component';
import { TileSpritesService } from '../services/tile-sprites.service';
import { TileService } from '../services/tile.service';
import { DatabaseService } from '../../../core/services/database.service';
import type { Tile } from '../../../shared/models/tile.model';
import type { Sprite } from '../../../shared/models/sprite.model';

const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
if (typeof dialogProto['showModal'] !== 'function') {
  dialogProto['showModal'] = function () {
    // no-op
  };
}
if (typeof dialogProto['close'] !== 'function') {
  dialogProto['close'] = function (returnValue?: string) {
    (this as unknown as HTMLDialogElement).returnValue = returnValue ?? '';
    (this as unknown as HTMLDialogElement).dispatchEvent(new Event('close'));
  };
}

describe('TilePropertiesComponent', () => {
  let fixture: ComponentFixture<TilePropertiesComponent>;
  let component: TilePropertiesComponent;
  let db: DatabaseService;
  const saved: Tile[] = [];

  function makeTile(overrides: Partial<Tile> = {}): Tile {
    return {
      id: 1,
      projectId: 'proj-1',
      name: 'Tile A',
      type: 'static',
      spriteIds: [],
      animationSpeed: 8,
      properties: { blocking: false, interactable: false },
      ...overrides,
    };
  }

  async function seedTile(overrides: Partial<Tile> = {}): Promise<Tile> {
    const tile = makeTile(overrides);
    await db.tiles.add(tile);
    return tile;
  }

  async function seedSprite(overrides: Partial<Omit<Sprite, 'id'>> = {}): Promise<Sprite> {
    const sprite: Omit<Sprite, 'id'> = {
      projectId: 'proj-1',
      tileId: 1,
      name: 'frame',
      width: 16,
      height: 16,
      pixelData: 'data:image/png;base64,AAA',
      paletteIndices: Array.from({ length: 16 }, () => Array<number>(16).fill(0)),
      ...overrides,
    };
    const id = await db.sprites.add(sprite as Sprite);
    return { ...sprite, id };
  }

  async function setup(tile: Tile): Promise<void> {
    saved.length = 0;
    fixture.componentRef.setInput('tile', tile);
    fixture.componentRef.setInput('projectTileSize', 16);
    fixture.componentRef.setInput('projectPalette', ['#ff0000', '#00ff00']);
    await TestBed.inject(TileSpritesService).loadForTile(tile.id);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function confirmButtonFor(dialogTitle: string): HTMLButtonElement | undefined {
    const dialogs = fixture.debugElement.queryAll(By.css('rk-confirm-dialog'));
    const target = dialogs.find((de) => de.nativeElement.textContent.includes(dialogTitle));
    if (!target) return undefined;
    const btns = target.queryAll(By.css('button'));
    return btns
      .map((b) => b.nativeElement as HTMLButtonElement)
      .find((b) => b.textContent?.trim() === 'Delete' || b.textContent?.trim() === 'Crop');
  }

  beforeEach(async () => {
    saved.length = 0;
    await TestBed.configureTestingModule({
      imports: [TilePropertiesComponent],
      providers: [TileSpritesService, TileService, provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(TilePropertiesComponent);
    component = fixture.componentInstance;
    db = TestBed.inject(DatabaseService);
    await db.projects.clear();
    await db.tiles.clear();
    await db.sprites.clear();
    // Wire outputs manually
    component.save.subscribe((t) => saved.push(t));
  });

  it('static tile renders one thumbnail bound to first sprite and navigates to sprite editor on click', async () => {
    const s = await seedSprite({ pixelData: 'data:image/png;base64,SPR1' });
    await setup(makeTile({ type: 'static', spriteIds: [s.id] }));
    const img = fixture.debugElement.query(By.css('img'));
    expect(img).toBeTruthy();
    expect((img.nativeElement as HTMLImageElement).src).toContain('SPR1');
    const navSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    img.nativeElement.closest('button')!.click();
    fixture.detectChanges();
    expect(navSpy).toHaveBeenCalledWith(['/project', 'proj-1', 'sprites', s.id]);
  });

  it('animated tile renders N thumbnails', async () => {
    const a = await seedSprite({ name: 'a' });
    const b = await seedSprite({ name: 'b' });
    const c = await seedSprite({ name: 'c' });
    const tile = await seedTile({ type: 'animated', spriteIds: [a.id, b.id, c.id] });
    await setup(tile);
    const imgs = fixture.debugElement.queryAll(By.css('img'));
    expect(imgs.length).toBe(3);
  });

  it('increasing frame count creates blank frames and refreshes shared sprite state', async () => {
    const a = await seedSprite({ name: 'a' });
    const tile = await seedTile({ type: 'animated', spriteIds: [a.id] });
    await setup(tile);
    const framesInput = fixture.debugElement.query(By.css('input[aria-label="Frames"]'));
    framesInput.triggerEventHandler('change', { target: { value: '3', valueAsNumber: 3 } });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    const frames = await db.sprites.where('tileId').equals(tile.id).toArray();
    expect(frames.length).toBe(3);
    expect(TestBed.inject(TileSpritesService).sprites().length).toBe(3);
  });

  it('decreasing frame count asks confirmation then deletes extras', async () => {
    const a = await seedSprite({ name: 'a' });
    const b = await seedSprite({ name: 'b' });
    const c = await seedSprite({ name: 'c' });
    const tile = await seedTile({ type: 'animated', spriteIds: [a.id, b.id, c.id] });
    await setup(tile);
    const framesInput = fixture.debugElement.query(By.css('input[aria-label="Frames"]'));
    framesInput.triggerEventHandler('change', { target: { value: '2', valueAsNumber: 2 } });
    fixture.detectChanges();
    const btn = confirmButtonFor('Delete Frames');
    expect(btn).toBeTruthy();
    btn!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 300));
    const frames = await db.sprites.where('tileId').equals(tile.id).toArray();
    expect(frames.length).toBe(2);
    expect(frames.some((f) => f.name === 'c')).toBe(false);
    expect(TestBed.inject(TileSpritesService).sprites().length).toBe(2);
  });

  it('switching animated to static with several frames triggers confirmation', async () => {
    const a = await seedSprite({ name: 'a' });
    const b = await seedSprite({ name: 'b' });
    const tile = await seedTile({ type: 'animated', spriteIds: [a.id, b.id] });
    await setup(tile);
    const typeSelect = fixture.debugElement.query(By.css('select[name="type"]'));
    typeSelect.triggerEventHandler('change', { target: { value: 'static' } });
    fixture.detectChanges();
    const btn = confirmButtonFor('Delete Frames');
    expect(btn).toBeTruthy();
    btn!.click();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 300));
    const frames = await db.sprites.where('tileId').equals(tile.id).toArray();
    expect(frames.length).toBe(1);
    expect(frames[0].name).toBe('a');
  });

  it('shrinking size opens Crop dialog then resizes all frames', async () => {
    const big: number[][] = Array.from({ length: 32 }, () => Array<number>(32).fill(0));
    big[10][10] = 5;
    const s = await seedSprite({ width: 32, height: 32, paletteIndices: big });
    const tile = await seedTile({ type: 'animated', spriteIds: [s.id] });
    await setup(tile);
    const w = fixture.debugElement.query(By.css('input[aria-label="Width (tiles)"]'));
    const h = fixture.debugElement.query(By.css('input[aria-label="Height (tiles)"]'));
    w.triggerEventHandler('input', { target: { value: '1', valueAsNumber: 1 } });
    h.triggerEventHandler('input', { target: { value: '1', valueAsNumber: 1 } });
    fixture.detectChanges();
    const applyBtn = fixture.debugElement
      .queryAll(By.css('button'))
      .map((b) => b.nativeElement as HTMLButtonElement)
      .find((b) => b.textContent?.trim() === 'Apply');
    applyBtn!.click();
    fixture.detectChanges();
    const btn = confirmButtonFor('Crop');
    expect(btn).toBeTruthy();
    btn!.click();
    await fixture.whenStable();
    const stored = await db.sprites.get(s.id);
    expect(stored?.width).toBe(16);
    expect(stored?.height).toBe(16);
    expect(stored?.paletteIndices).toHaveLength(16);
  });

  it('confirming crop applies the confirmed dimensions even if inputs change afterwards', async () => {
    const big: number[][] = Array.from({ length: 32 }, () => Array<number>(32).fill(0));
    const s = await seedSprite({ width: 32, height: 32, paletteIndices: big });
    const tile = await seedTile({ type: 'animated', spriteIds: [s.id] });
    await setup(tile);
    const w = fixture.debugElement.query(By.css('input[aria-label="Width (tiles)"]'));
    const h = fixture.debugElement.query(By.css('input[aria-label="Height (tiles)"]'));
    w.triggerEventHandler('input', { target: { value: '1', valueAsNumber: 1 } });
    h.triggerEventHandler('input', { target: { value: '1', valueAsNumber: 1 } });
    fixture.detectChanges();
    const applyBtn = fixture.debugElement
      .queryAll(By.css('button'))
      .map((b) => b.nativeElement as HTMLButtonElement)
      .find((b) => b.textContent?.trim() === 'Apply');
    applyBtn!.click();
    fixture.detectChanges();
    // User edits the inputs while the Crop dialog is open.
    w.triggerEventHandler('input', { target: { value: '3', valueAsNumber: 3 } });
    h.triggerEventHandler('input', { target: { value: '3', valueAsNumber: 3 } });
    fixture.detectChanges();
    const btn = confirmButtonFor('Crop');
    expect(btn).toBeTruthy();
    btn!.click();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 100));
    const stored = await db.sprites.get(s.id);
    expect(stored?.width).toBe(16);
    expect(stored?.height).toBe(16);
  });

  it('growing size resizes without dialog', async () => {
    const s = await seedSprite({});
    const tile = await seedTile({ type: 'animated', spriteIds: [s.id] });
    await setup(tile);
    const w = fixture.debugElement.query(By.css('input[aria-label="Width (tiles)"]'));
    const h = fixture.debugElement.query(By.css('input[aria-label="Height (tiles)"]'));
    w.triggerEventHandler('input', { target: { value: '2', valueAsNumber: 2 } });
    h.triggerEventHandler('input', { target: { value: '2', valueAsNumber: 2 } });
    fixture.detectChanges();
    const applyBtn = fixture.debugElement
      .queryAll(By.css('button'))
      .map((b) => b.nativeElement as HTMLButtonElement)
      .find((b) => b.textContent?.trim() === 'Apply');
    applyBtn!.click();
    await fixture.whenStable();
    const stored = await db.sprites.get(s.id);
    expect(stored?.width).toBe(32);
    expect(stored?.height).toBe(32);
  });

  it('unchecking interactable auto-saves actionId undefined', async () => {
    await setup(
      makeTile({
        type: 'static',
        properties: { blocking: false, interactable: true, actionId: 'test' },
      }),
    );
    expect(fixture.debugElement.query(By.css('rk-searchable-select'))).toBeTruthy();
    const cb = fixture.debugElement.query(By.css('input[name="interactable"]'))
      .nativeElement as HTMLInputElement;
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    component.flushAutosave();
    fixture.detectChanges();
    expect(saved).toHaveLength(1);
    expect(saved[0].properties.actionId).toBeUndefined();
  });

  it('interactable checked shows dropdown; choosing test saves actionId test', async () => {
    await setup(makeTile({ type: 'static' }));
    const cb = fixture.debugElement.query(By.css('input[name="interactable"]'))
      .nativeElement as HTMLInputElement;
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('rk-searchable-select'))).toBeTruthy();
    const input = fixture.debugElement.query(By.css('rk-searchable-select input'));
    input.triggerEventHandler('focus', {});
    input.triggerEventHandler('input', { target: { value: 'test' } });
    fixture.detectChanges();
    const opt = fixture.debugElement
      .queryAll(By.css('button[role="option"]'))
      .find((o) => o.nativeElement.textContent.trim() === 'test');
    opt!.nativeElement.click();
    fixture.detectChanges();
    component.flushAutosave();
    fixture.detectChanges();
    expect(saved[0].properties.actionId).toBe('test');
    expect(saved[0].properties.interactable).toBe(true);
  });

  it('unknown stored actionId displays unknown-action hint', async () => {
    await setup(
      makeTile({ properties: { blocking: false, interactable: true, actionId: 'ghost' } }),
    );
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('(action inconnue)');
  });

  it('sprite mutation keeps unsaved name edits in the form', async () => {
    await setup(makeTile({ name: 'Original' }));
    const nameInput = fixture.debugElement.query(By.css('input[name="name"]'))
      .nativeElement as HTMLInputElement;
    nameInput.value = 'Typed edit';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(nameInput.value).toBe('Typed edit');
    // Replacing the shared sprites array (frame create/delete/resize) must
    // not re-patch identity fields from stored values mid-edit.
    await TestBed.inject(TileSpritesService).markMutated();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();
    const after = fixture.debugElement.query(By.css('input[name="name"]'))
      .nativeElement as HTMLInputElement;
    expect(after.value).toBe('Typed edit');
  });

  it('form save emits blocking property; legacy fields gone from DOM', async () => {
    await setup(makeTile());
    const nameInput = fixture.debugElement.query(By.css('input[name="name"]'))
      .nativeElement as HTMLInputElement;
    nameInput.value = 'Renamed';
    nameInput.dispatchEvent(new Event('input'));
    const blockingCb = fixture.debugElement.query(By.css('input[name="blocking"]'))
      .nativeElement as HTMLInputElement;
    blockingCb.checked = true;
    blockingCb.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    component.flushAutosave();
    fixture.detectChanges();
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('Renamed');
    expect(saved[0].properties.blocking).toBe(true);
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Collision');
    expect(text).not.toContain('Solid');
  });

  it('renders no Save button', async () => {
    await setup(makeTile());
    const saveBtn = fixture.debugElement
      .queryAll(By.css('button'))
      .map((b) => b.nativeElement as HTMLButtonElement)
      .find((b) => b.textContent?.trim() === 'Save');
    expect(saveBtn).toBeUndefined();
  });

  it('flushAutosave skips emission when nothing changed', async () => {
    await setup(makeTile());
    component.flushAutosave();
    fixture.detectChanges();
    expect(saved).toHaveLength(0);
  });

  it('auto-saves form edits ~400ms after the last change', async () => {
    await setup(makeTile());
    const nameInput = fixture.debugElement.query(By.css('input[name="name"]'))
      .nativeElement as HTMLInputElement;
    nameInput.value = 'Auto Saved';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(saved).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 500));
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('Auto Saved');
  });
});
