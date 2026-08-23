import 'fake-indexeddb/auto';
import { vi } from 'vitest';

if (!('showModal' in HTMLDialogElement.prototype)) {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    value: vi.fn(),
    writable: true,
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    value: vi.fn(),
    writable: true,
  });
}

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { SpriteEditorComponent } from './sprite-editor.component';
import { DatabaseService } from '../../core/services/database.service';
import { NotificationService } from '../../core/services/notification.service';
import { SpriteService } from './services/sprite.service';

describe('SpriteEditorComponent', () => {
  let fixture: ComponentFixture<SpriteEditorComponent>;
  const parentParams = new BehaviorSubject<{ id?: string }>({});
  const routeParams = new BehaviorSubject<{ spriteId?: string }>({});

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpriteEditorComponent],
      providers: [
        provideRouter([]),
        SpriteService,
        {
          provide: ActivatedRoute,
          useValue: {
            parent: { params: parentParams.asObservable() },
            params: routeParams.asObservable(),
            pathFromRoot: [] as unknown[],
          },
        },
      ],
    }).compileComponents();

    const db = TestBed.inject(DatabaseService);
    await db.projects.clear();
    await db.scenes.clear();
    await db.tiles.clear();
    await db.sprites.clear();
    await db.sessions.clear();

    // Reset route param streams so subscriptions created in the next test
    // do not replay a stale spriteId from a previous test.
    parentParams.next({});
    routeParams.next({});
  });

  async function setupWithProject() {
    parentParams.next({ id: 'test-proj' });
    fixture = TestBed.createComponent(SpriteEditorComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Flushes async route-subscription work (Dexie promises are not tracked by whenStable). */
  async function flushRouteWork() {
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
  }

  async function createProjectWithPalette() {
    const db = TestBed.inject(DatabaseService);
    await db.projects.add({
      id: 'test-proj',
      name: 'Test Project',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      palette: ['#ff0000', '#00ff00', '#0000ff'],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    });
  }

  it('should create', async () => {
    await createProjectWithPalette();
    await setupWithProject();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show placeholder when no sprite selected', async () => {
    await createProjectWithPalette();
    await setupWithProject();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Select a sprite to edit');
  });

  it('should list sprites after creating one', async () => {
    await createProjectWithPalette();
    await setupWithProject();
    const service = TestBed.inject(SpriteService);
    await service.createSprite('test-proj', 'Test Sprite', 1);
    await fixture.componentInstance.loadSprites();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Test Sprite');
  });

  it('should select a sprite and show canvas', async () => {
    await createProjectWithPalette();
    await setupWithProject();
    const service = TestBed.inject(SpriteService);
    const sprite = await service.createSprite('test-proj', 'Test Sprite', 1);
    await fixture.componentInstance.loadSprites();
    await fixture.componentInstance.selectSprite(sprite.id);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('rk-pixel-canvas')).toBeTruthy();
  });

  it('should delete sprite after confirmation', async () => {
    await createProjectWithPalette();
    await setupWithProject();
    const service = TestBed.inject(SpriteService);
    const sprite = await service.createSprite('test-proj', 'To Delete', 1);
    await fixture.componentInstance.loadSprites();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const deleteButton = compiled.querySelector('button[title="Delete"]') as HTMLButtonElement;
    expect(deleteButton).toBeTruthy();
    deleteButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    // Confirm dialog should now be open with spriteToDelete set
    expect(fixture.componentInstance.spriteToDelete()).toBe(sprite.id);

    await fixture.componentInstance.deleteSprite(sprite.id);
    fixture.detectChanges();

    const remaining = await service.getSprites('test-proj');
    expect(remaining.length).toBe(0);
  });

  it('enters focus mode and auto-selects the sprite when a spriteId param is present', async () => {
    await createProjectWithPalette();
    const service = TestBed.inject(SpriteService);
    const sprite = await service.createSprite('test-proj', 'Focused Sprite', 1);
    await setupWithProject();

    routeParams.next({ spriteId: String(sprite.id) });
    await flushRouteWork();
    fixture.detectChanges();

    expect(fixture.componentInstance.focusMode()).toBe(true);
    expect(fixture.componentInstance.selectedSpriteId()).toBe(sprite.id);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Back to tiles');
    expect(compiled.textContent).toContain('Focused Sprite');
    expect(compiled.querySelector('rk-palette-manager')).toBeNull();
    expect(compiled.querySelector('rk-drawing-tools')).toBeNull();
  });

  it('stays in normal editing mode when no spriteId param is present', async () => {
    await createProjectWithPalette();
    await setupWithProject();

    routeParams.next({});
    await flushRouteWork();
    fixture.detectChanges();

    expect(fixture.componentInstance.focusMode()).toBe(false);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Back to tiles');
    expect(compiled.querySelector('rk-palette-manager')).toBeTruthy();
    expect(compiled.querySelector('rk-drawing-tools')).toBeTruthy();
  });

  it('shows an error and redirects back to tiles for an unknown spriteId param', async () => {
    await createProjectWithPalette();
    await setupWithProject();

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const notification = TestBed.inject(NotificationService);
    const errorSpy = vi.spyOn(notification, 'error');

    routeParams.next({ spriteId: '9999' });
    await flushRouteWork();

    expect(errorSpy).toHaveBeenCalledWith('Sprite not found');
    expect(navigateSpy).toHaveBeenCalledWith(['/project', 'test-proj', 'tiles']);
  });

  it('shows an error notification when focus mode fails to load the sprite', async () => {
    await createProjectWithPalette();
    await setupWithProject();

    // SpriteService is provided at the component level, so resolve it from
    // the component's injector to spy on the instance the component actually uses.
    const service = fixture.debugElement.injector.get(SpriteService);
    const notification = TestBed.inject(NotificationService);
    const errorSpy = vi.spyOn(notification, 'error');
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(service, 'getSprite').mockRejectedValue(new Error('db failure'));

    routeParams.next({ spriteId: '7' });
    await flushRouteWork();

    expect(errorSpy).toHaveBeenCalledWith('Failed to load sprite');
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
