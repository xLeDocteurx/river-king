import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { SessionService, screenFromUrl } from './session.service';
import { DatabaseService } from '../../core/services/database.service';
import { createEmptySession, type Session } from '../../shared/models/session.model';

describe('SessionService', () => {
  let service: SessionService;
  let db: DatabaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SessionService, DatabaseService] });
    service = TestBed.inject(SessionService);
    db = TestBed.inject(DatabaseService);
    // Clean up tables
    ['projects', 'scenes', 'tiles', 'sprites', 'sessions'].forEach((table) =>
      (db as unknown as Record<string, { clear?: () => Promise<number> }>)[table]?.clear?.(),
    );
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get session for project', async () => {
    await db.sessions.add({
      ...createEmptySession('proj-1'),
      lastSceneId: 'scene-1',
      cameraX: 100,
      cameraY: 200,
      cameraZoom: 2,
    });
    const session = await service.getSession('proj-1');
    expect(session?.lastSceneId).toBe('scene-1');
    expect(session?.cameraZoom).toBe(2);
  });

  it('should save session for project', async () => {
    await service.saveSession({
      ...createEmptySession('proj-2'),
      lastSceneId: 'scene-2',
      cameraX: 50,
      cameraY: 75,
      cameraZoom: 1.5,
    });
    const result = await db.sessions.get('proj-2');
    expect(result?.cameraX).toBe(50);
  });

  it('should update session partially', async () => {
    await service.saveSession(createEmptySession('proj-3'));
    await service.updateSession('proj-3', { cameraX: 999 });
    const result = await db.sessions.get('proj-3');
    expect(result?.cameraX).toBe(999);
    expect(result?.cameraY).toBe(0); // unchanged
  });

  it('should return undefined for non-existent session', async () => {
    const result = await service.getSession('non-existent');
    expect(result).toBeUndefined();
  });

  it('should create a defaulted session when updating a missing one', async () => {
    await service.updateSession('proj-new', { lastScreen: 'tiles', lastTileId: 7 });
    const result = await db.sessions.get('proj-new');
    expect(result).toEqual({
      projectId: 'proj-new',
      lastScreen: 'tiles',
      lastSceneId: null,
      cameraX: 0,
      cameraY: 0,
      cameraZoom: 1,
      lastTileId: 7,
      lastSpriteId: null,
    });
  });

  it('should backfill missing fields when updating a legacy session row', async () => {
    await db.sessions.add({
      projectId: 'proj-legacy',
      lastSceneId: 'scene-9',
      cameraX: 12,
      cameraY: 34,
      cameraZoom: 2,
    } as Session);
    await service.updateSession('proj-legacy', { lastSpriteId: 5 });
    const result = await db.sessions.get('proj-legacy');
    expect(result?.lastScreen).toBe('scenes');
    expect(result?.lastSpriteId).toBe(5);
    expect(result?.lastSceneId).toBe('scene-9');
    expect(result?.cameraZoom).toBe(2);
  });
});

describe('screenFromUrl', () => {
  it.each([
    ['/project/p1/scenes', 'scenes'],
    ['/project/p1/tiles', 'tiles'],
    ['/project/p1/sprites/42', 'sprites'],
    ['/project/p1/scenes?x=1', 'scenes'],
  ])('extracts %s -> %s', (url, expected) => {
    expect(screenFromUrl(url)).toBe(expected);
  });

  it.each([
    ['/project/p1', null],
    ['/project/p1/unknown', null],
    ['/', null],
  ])('returns null for non-screen url %s', (url, expected) => {
    expect(screenFromUrl(url)).toBe(expected);
  });
});
