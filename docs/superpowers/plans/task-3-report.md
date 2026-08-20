# Task 3 Report: ProjectService (CRUD Operations)

## Status

DONE

## Files Created/Modified

- Created: `src/app/features/dashboard/services/project.service.ts`
- Created: `src/app/features/dashboard/services/project.service.spec.ts`

## Test Results

Command: `devbox run npm run test`
Output summary:
- Initial run failed because `project.service.ts` did not exist yet (expected TDD failure).
- Second run failed because fake-indexeddb state was shared across test files, causing `getAll` to see 3 projects instead of 2.
- Added table cleanup (`clear()`) in `beforeEach` to ensure test isolation.
- Final run: **PASS**
  - Test files: 3 passed
  - Tests: 11 passed (6 in project.service.spec.ts)

## Lint Results

Command: `devbox run npm run lint`
Result: **PASS** — All files pass linting.

## Git Commit Hash

`bae1576`

## Issues Encountered

1. **Shared IndexedDB state across tests**: The `fake-indexeddb/auto` polyfill persists data between test files. The `should list all projects sorted by updatedAt desc` test initially failed because it found 3 projects (1 leftover from `database.service.spec.ts` + 2 newly created).
   - **Resolution**: Added cleanup calls in `beforeEach` to clear all Dexie tables (`projects`, `scenes`, `tiles`, `sprites`, `sessions`) before each test in `project.service.spec.ts`.
