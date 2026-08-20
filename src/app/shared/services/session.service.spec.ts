import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { SessionService } from './session.service';
import { DatabaseService } from '../../core/services/database.service';

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
      projectId: 'proj-1',
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
      projectId: 'proj-2',
      lastSceneId: 'scene-2',
      cameraX: 50,
      cameraY: 75,
      cameraZoom: 1.5,
    });
    const result = await db.sessions.get('proj-2');
    expect(result?.cameraX).toBe(50);
  });

  it('should update session partially', async () => {
    await service.saveSession({
      projectId: 'proj-3',
      lastSceneId: null,
      cameraX: 0,
      cameraY: 0,
      cameraZoom: 1,
    });
    await service.updateSession('proj-3', { cameraX: 999 });
    const result = await db.sessions.get('proj-3');
    expect(result?.cameraX).toBe(999);
    expect(result?.cameraY).toBe(0); // unchanged
  });

  it('should return undefined for non-existent session', async () => {
    const result = await service.getSession('non-existent');
    expect(result).toBeUndefined();
  });
});
