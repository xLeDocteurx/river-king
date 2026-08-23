import 'fake-indexeddb/auto';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { TileManagerComponent } from './tile-manager.component';
import { DatabaseService } from '../../core/services/database.service';
import { TileService } from './services/tile.service';
import { TileSpritesService } from './services/tile-sprites.service';
import { ProjectService } from '../../features/dashboard/services/project.service';

describe('TileManagerComponent', () => {
  let fixture: ComponentFixture<TileManagerComponent>;
  const parentParams = new BehaviorSubject<{ id?: string }>({});

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TileManagerComponent],
      providers: [
        TileService,
        TileSpritesService,
        ProjectService,
        provideRouter([]),
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
    fixture = TestBed.createComponent(TileManagerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('should create', async () => {
    await setupWithProject();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show placeholder when no tile selected', async () => {
    await setupWithProject();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Select a tile to edit its properties');
  });

  it('loads project palette and tileSize on init', async () => {
    const db = TestBed.inject(DatabaseService);
    await db.projects.add({
      id: 'test-proj',
      name: 'Test Project',
      createdAt: 0,
      updatedAt: 0,
      palette: ['#ff0000', '#00ff00'],
      tileSize: 32,
      mapWidth: 40,
      mapHeight: 30,
    });
    await setupWithProject();
    await new Promise((r) => setTimeout(r, 100));
    const comp = fixture.componentInstance;
    expect(comp.tileSize()).toBe(32);
    expect(comp.palette()).toEqual(['#ff0000', '#00ff00']);
  });

  it('loads tile sprites when a tile is selected', async () => {
    const db = TestBed.inject(DatabaseService);
    await db.projects.add({
      id: 'test-proj',
      name: 'Test Project',
      createdAt: 0,
      updatedAt: 0,
      palette: [],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    });
    const tileId = await db.tiles.add({
      projectId: 'test-proj',
      name: 'T',
      type: 'static',
      spriteIds: [],
      animationSpeed: 8,
      properties: { blocking: false, interactable: false },
    } as unknown as import('../../shared/models/tile.model').Tile);
    await db.sprites.add({
      projectId: 'test-proj',
      tileId,
      name: 'frame',
      width: 16,
      height: 16,
      pixelData: 'data:image/png;base64,SPR',
      paletteIndices: Array.from({ length: 16 }, () => Array<number>(16).fill(0)),
    } as unknown as import('../../shared/models/sprite.model').Sprite);
    await setupWithProject();
    const comp = fixture.componentInstance;
    const spriteService = fixture.debugElement.injector.get(TileSpritesService);
    await comp.selectTile(tileId);
    expect(spriteService.sprites().length).toBe(1);
    expect(spriteService.sprites()[0].pixelData).toContain('SPR');
  });
});
