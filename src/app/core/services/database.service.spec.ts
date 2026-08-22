import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { DatabaseService, migrateTileProperties } from './database.service';

describe('migrateTileProperties', () => {
  it('merges collision/solid into blocking', () => {
    expect(migrateTileProperties({ collision: true, solid: false, layer: 'background' })).toEqual({
      blocking: true,
      interactable: false,
      actionId: undefined,
    });
  });

  it('keeps interactable, drops eventScript/layer', () => {
    const result = migrateTileProperties({
      collision: false,
      solid: true,
      interactable: true,
      eventScript: 'x()',
      layer: 'foreground',
    });
    expect(result).toEqual({ blocking: true, interactable: true, actionId: undefined });
  });

  it('handles missing properties', () => {
    expect(migrateTileProperties(undefined)).toEqual({
      blocking: false,
      interactable: false,
      actionId: undefined,
    });
  });
});

describe('DatabaseService v3 migration', () => {
  it('opens at version 3', () => {
    TestBed.configureTestingModule({});
    const db = TestBed.inject(DatabaseService);
    expect(db.verno).toBe(3);
  });
});

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DatabaseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have projects table', () => {
    expect(service.projects).toBeTruthy();
  });

  it('should add and retrieve a project', async () => {
    const project = {
      id: 'test-1',
      name: 'Test Project',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      palette: ['#000000'],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    };
    await service.projects.add(project);
    const result = await service.projects.get('test-1');
    expect(result?.name).toBe('Test Project');
  });
});
