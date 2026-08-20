# Task 1: Database Service (Dexie.js Setup)

> **For agentic worker:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `DatabaseService` — `providedIn: 'root'` service that wraps Dexie.js and defines the IndexedDB schema for the River King game engine.

**Tech Stack:** Angular 22, TypeScript ~6.0, Dexie.js (^4.4.5), `@angular/build:unit-test` (Vitest + jsdom), standalone components, ChangeDetectionStrategy.OnPush.

**Global Constraints (copy verbatim):**

- Standalone Angular components only. No `NgModule`. Use `imports: [...]` in `@Component()`.
- Change detection: Prefer `ChangeDetectionStrategy.OnPush`.
- Signals preferred for state.
- Do not expose RxJS Observables when a signal will do.
- Component selector prefix: `rk` (from `angular.json`).
- Tailwind CSS prefix: `tw-` (always use `tw-bg-red-500`, never `bg-red-500`).
- `core/` must stay independent; it is not allowed to import from `shared/` or `features/`.
- Tests via `npm run test` (Vitest under the hood). No `vitest.config.ts`.
- Use `TestBed.configureTestingModule({ imports: [ComponentUnderTest] })` for standalone component setup.
- Run commands via Devbox: `devbox run npm run ...`
- Commit message prefix: `feature-1-database-service:`
- Branch: `feature-1-database-service`

**Files:**

- Create: `src/app/core/services/database.service.ts`
- Create: `src/app/core/services/database.service.spec.ts`

**Interfaces:**

- Consumes: None (new service)
- Produces: `DatabaseService` with `projects`, `scenes`, `tiles`, `sprites`, `sessions` tables

## Steps

### Step 1: Write the failing test

Create: `src/app/core/services/database.service.spec.ts`

```typescript
import { TestBed } from '@angular/core/testing';
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
```

### Step 2: Run test to verify it fails

Run: `cd /home/lenoir/river-king && devbox run npm run test`
Expected: FAIL with "DatabaseService is not defined" or similar.

### Step 3: Implement DatabaseService

Create: `src/app/core/services/database.service.ts`

```typescript
import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Project } from '../../shared/models/project.model';
import { Scene } from '../../shared/models/scene.model';
import { Tile } from '../../shared/models/tile.model';
import { Sprite } from '../../shared/models/sprite.model';
import { Session } from '../../shared/models/session.model';

@Injectable({ providedIn: 'root' })
export class DatabaseService extends Dexie {
  projects!: Table<Project, string>;
  scenes!: Table<Scene, string>;
  tiles!: Table<Tile, number>;
  sprites!: Table<Sprite, number>;
  sessions!: Table<Session, string>;

  constructor() {
    super('RiverKingDB');
    this.version(1).stores({
      projects: 'id, name, createdAt, updatedAt',
      scenes: 'id, projectId, name, folderPath',
      tiles: '++id, projectId, name, type',
      sprites: '++id, projectId, tileId',
      sessions: 'projectId',
    });
  }
}
```

**IMPORTANT:** The models (`project.model.ts`, `scene.model.ts`, `tile.model.ts`, `sprite.model.ts`, `session.model.ts`) do NOT yet exist in this branch. Create them first in `src/app/shared/models/` before implementing `DatabaseService`, or define inline `interface` placeholders. The actual model files will be created in Task 2. For this task, define the interfaces locally in `database.service.ts` to avoid import errors, and leave a `TODO` comment to migrate them to `shared/models/` later.

### Step 4: Run test to verify it passes

Run: `cd /home/lenoir/river-king && devbox run npm run test`
Expected: PASS

### Step 5: Commit

```bash
git add src/app/core/services/database.service.ts src/app/core/services/database.service.spec.ts
git commit -m "feature-1-database-service: add DatabaseService with IndexedDB schema"
```

**Post-implementation:** Write a brief report in `docs/superpowers/plans/task-1-report.md` with:

- Status: DONE or DONE_WITH_CONCERNS or BLOCKED
- Commits made
- Tests run and results
- Any concerns or deviations from plan
