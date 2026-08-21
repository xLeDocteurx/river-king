# Task 3: Project Service (CRUD Operations)

**Files:**

- Create: `src/app/features/dashboard/services/project.service.ts`
- Create: `src/app/features/dashboard/services/project.service.spec.ts`

**Context:**
This is Task 3 of a multi-task Angular 22 game engine build. Task 1 (DatabaseService) and Task 2 (Domain Models) are complete. This service provides CRUD operations for projects with cascade delete.

**Interfaces:**

- Consumes: `DatabaseService.projects` table, `Project` type from `shared/models/project.model.ts`
- Produces: `ProjectService` with async CRUD methods

**Global Constraints (apply to all tasks):**

- Angular 22 standalone components, ChangeDetectionStrategy.OnPush
- Prefer signals over RxJS Subject/BehaviorSubject
- Tailwind prefix required: `tw-`
- Component selectors prefixed with `rk`
- All deletions require confirmation modal (handled by consumers, not this service)
- Tests via Vitest + jsdom, no real browser. Use `fake-indexeddb` for IndexedDB in tests.

---

## Step 1: Write the failing test

Create: `src/app/features/dashboard/services/project.service.spec.ts`

Note: The service file under test `project.service.ts` does not exist yet — tests will fail.

```typescript
import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { ProjectService } from './project.service';
import { DatabaseService } from '../../../core/services/database.service';

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProjectService);
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
      tileData: [],
    });
    await service.delete(project.id);
    const deletedProject = await db.projects.get(project.id);
    const deletedScene = await db.scenes.where('projectId').equals(project.id).first();
    expect(deletedProject).toBeUndefined();
    expect(deletedScene).toBeUndefined();
  });
});
```

---

## Step 2: Run test to verify it fails

Run: `cd /home/lenoir/river-king && devbox run npm run test`
Expected: FAIL with "ProjectService is not defined" or module not found

---

## Step 3: Implement ProjectService

Create: `src/app/features/dashboard/services/project.service.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import type { Project } from '../../../shared/models/project.model';

export interface CreateProjectDto {
  name: string;
  palette: string[];
  tileSize: number;
  mapWidth: number;
  mapHeight: number;
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly db = inject(DatabaseService);

  async create(dto: CreateProjectDto): Promise<Project> {
    const now = Date.now();
    const project: Project = {
      id: crypto.randomUUID(),
      ...dto,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.projects.add(project);
    return project;
  }

  async getAll(): Promise<Project[]> {
    return this.db.projects.orderBy('updatedAt').reverse().toArray();
  }

  async getById(id: string): Promise<Project | undefined> {
    return this.db.projects.get(id);
  }

  async update(id: string, changes: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<void> {
    await this.db.projects.update(id, { ...changes, updatedAt: Date.now() });
  }

  async delete(id: string): Promise<void> {
    await this.db.projects.delete(id);
    // Cascade: delete related entities
    await this.db.scenes.where('projectId').equals(id).delete();
    await this.db.tiles.where('projectId').equals(id).delete();
    await this.db.sprites.where('projectId').equals(id).delete();
    await this.db.sessions.where('projectId').equals(id).delete();
  }
}
```

---

## Step 4: Run test to verify it passes

Run: `cd /home/lenoir/river-king && devbox run npm run test`
Expected: PASS — all 6 tests pass

Also run: `cd /home/lenoir/river-king && devbox run npm run lint`
Expected: PASS

---

## Step 5: Commit

```bash
cd /home/lenoir/river-king
git add src/app/features/dashboard/services/
git commit -m "feature-3-project-service: add ProjectService with CRUD and cascade delete"
```

---

**Verification:** Run `git log --oneline -3` and print the latest commit hash.

**Report file:** Write a brief status report to `docs/superpowers/plans/task-3-report.md` including:

- Status: DONE / DONE_WITH_CONCERNS / BLOCKED
- Files created/modified
- Test results (pass/fail + count)
- Lint results
- Git commit hash
- Any issues encountered
