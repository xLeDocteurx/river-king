import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { DatabaseService } from './database.service';

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
