import 'fake-indexeddb/auto';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { TileManagerComponent } from './tile-manager.component';
import { DatabaseService } from '../../../../core/services/database.service';
import { TileService } from '../../services/tile.service';

describe('TileManagerComponent', () => {
  let fixture: ComponentFixture<TileManagerComponent>;
  const parentParams = new BehaviorSubject<{ id?: string }>({});

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TileManagerComponent],
      providers: [
        TileService,
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
});
