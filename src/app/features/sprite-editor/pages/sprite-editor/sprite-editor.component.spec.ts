import 'fake-indexeddb/auto';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { SpriteEditorComponent } from './sprite-editor.component';
import { DatabaseService } from '../../../../core/services/database.service';
import { SpriteService } from '../../services/sprite.service';

describe('SpriteEditorComponent', () => {
  let fixture: ComponentFixture<SpriteEditorComponent>;
  const parentParams = new BehaviorSubject<{ id?: string }>({});

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpriteEditorComponent],
      providers: [
        SpriteService,
        {
          provide: ActivatedRoute,
          useValue: {
            parent: { params: parentParams.asObservable() },
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
  });

  async function setupWithProject() {
    parentParams.next({ id: 'test-proj' });
    fixture = TestBed.createComponent(SpriteEditorComponent);
    fixture.detectChanges();
    await fixture.whenStable();
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
    await fixture.componentInstance.selectSprite(sprite.id);
    fixture.detectChanges();

    fixture.componentInstance.requestDelete(sprite.id);
    fixture.detectChanges();

    await fixture.componentInstance.deleteSprite(sprite.id);
    fixture.detectChanges();

    const remaining = await service.getSprites('test-proj');
    expect(remaining.length).toBe(0);
  });
});
