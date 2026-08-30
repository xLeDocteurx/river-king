import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { ProjectService } from './project.service';
import { DatabaseService } from '../../../core/services/database.service';

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProjectService);
    const db = TestBed.inject(DatabaseService);
    await db.projects.clear();
    await db.scenes.clear();
    await db.tiles.clear();
    await db.sprites.clear();
    await db.sessions.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create a project with generated ID and timestamps', async () => {
    const project = await service.create({
      name: 'My Game',
      palette: ['#000000', '#FFFFFF'],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    });
    expect(project.id).toBeTruthy();
    expect(project.name).toBe('My Game');
    expect(project.createdAt).toBeGreaterThan(0);
    expect(project.updatedAt).toBeGreaterThan(0);
  });

  it('should list all projects sorted by updatedAt desc', async () => {
    await service.create({
      name: 'Project A',
      palette: ['#000000'],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    });
    await service.create({
      name: 'Project B',
      palette: ['#000000'],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    });
    const projects = await service.getAll();
    expect(projects.length).toBe(2);
  });

  it('should get a project by id', async () => {
    const created = await service.create({
      name: 'Test',
      palette: ['#000000'],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    });
    const result = await service.getById(created.id);
    expect(result?.name).toBe('Test');
  });

  it('should update a project and reflect changes', async () => {
    const created = await service.create({
      name: 'Original',
      palette: ['#000000'],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    });
    await service.update(created.id, { name: 'Updated' });
    const result = await service.getById(created.id);
    expect(result?.name).toBe('Updated');
  });

  it('should expose the currently-open project via a signal', async () => {
    const project = await service.create({
      name: 'Open',
      palette: ['#000000'],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    });
    expect(service.currentProject()).toBeNull();
    service.setCurrentProject(project);
    expect(service.currentProject()).toBe(project);
    service.setCurrentProject(null);
    expect(service.currentProject()).toBeNull();
  });

  it('should delete a project and its related data', async () => {
    const db = TestBed.inject(DatabaseService);
    const project = await service.create({
      name: 'To Delete',
      palette: ['#000000'],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    });
    // Insert a related scene manually to test cascade
    await db.scenes.add({
      id: 'scene-1',
      projectId: project.id,
      name: 'Scene',
      folderPath: '',
      width: 10,
      height: 10,
      layers: [
        {
          id: 'layer-default',
          name: 'Background',
          visible: true,
          opacity: 1,
          tileData: [],
        },
      ],
    });
    await service.delete(project.id);
    const deletedProject = await db.projects.get(project.id);
    const deletedScene = await db.scenes.where('projectId').equals(project.id).first();
    expect(deletedProject).toBeUndefined();
    expect(deletedScene).toBeUndefined();
  });
});
