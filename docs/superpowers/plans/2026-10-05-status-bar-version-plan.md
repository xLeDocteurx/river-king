# Status Bar Version Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the app version (`River King Engine — vX.Y.Z`) in the status bar's right side, read from `package.json` at build time.

**Architecture:** A single core module `src/app/core/app-version.ts` re-exports the `version` field imported from `package.json`. The root `App` component exposes it and the footer template renders it. `resolveJsonModule: true` in the base `tsconfig.json` lets both the app builder and the unit-test builder type-check the JSON import (esbuild resolves it natively).

**Tech Stack:** Angular 22, TypeScript ~6, Vitest, esbuild.

## Global Constraints

- Branch `feature-74`, commit prefix `feature-74:`, PR into `develop` with `Closes #74`.
- Version string is `package.json`'s `version`; the display is exactly `River King Engine — vX.Y.Z` (em dash, single spaces).
- Topbar brand (`app.component.html:12`) stays the plain literal `River King Engine` — only the footer changes.
- UI copy English; design system unchanged (footer classes untouched, 11px, `tw-bg-primary`).
- No new service, no `StatusBarService` change: the footer's right side is root-owned.
- Every new export gets a JSDoc block.

---

### Task 1: Expose the package version and render it in the footer

**Files:**

- Create: `src/app/core/app-version.ts`
- Modify: `tsconfig.json` (add `resolveJsonModule`)
- Modify: `src/app/app.ts`
- Modify: `src/app/app.component.html`
- Test: `src/app/app.spec.ts`

**Interfaces:**

- Produces: `export const APP_VERSION: string` from `src/app/core/app-version.ts` — the `version` field of `package.json`, prefixed by nothing (consumer adds the `v`).
- Consumes: `AppComponent` template binding `versionLabel` (`protected readonly` field on `App`).

- [ ] **Step 1: Write the failing test**

In `src/app/app.spec.ts`, add the import:

```ts
import { APP_VERSION } from './core/app-version';
```

Then add this test inside the `describe`:

```ts
it('should render the app version in the status bar', () => {
  fixture.detectChanges();

  const compiled = fixture.nativeElement as HTMLElement;
  const footer = compiled.querySelector('footer');
  expect(footer?.textContent).toContain(`River King Engine — v${APP_VERSION}`);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `devbox run npx ng test --watch=false --include='**/app.spec.ts'`
Expected: FAIL — cannot resolve `./core/app-version` (module not found).

- [ ] **Step 3: Create the version module**

Create `src/app/core/app-version.ts`:

```ts
import { version } from '../../package.json';

/**
 * Application version, read from the `version` field of `package.json` at
 * build time. This is the single source of truth for the release version
 * (bumped manually in the release runbook, see `docs/release-process.md`).
 */
export const APP_VERSION = version;
```

- [ ] **Step 4: Enable JSON module resolution**

In `tsconfig.json`, inside `compilerOptions`, add the flag right after `"skipLibCheck": true,`:

```json
    "resolveJsonModule": true,
```

- [ ] **Step 5: Run to verify the test now fails on the assertion (not on imports)**

Run: `devbox run npx ng test --watch=false --include='**/app.spec.ts'`
Expected: FAIL — the footer still contains only `River King Engine` (no `— v0.0.0`).

- [ ] **Step 6: Render the version in the footer**

In `src/app/app.ts`, add the import:

```ts
import { APP_VERSION } from './core/app-version';
```

and add the protected field inside the `App` class, right after `protected readonly status = inject(StatusBarService);`:

```ts
  /** Footer branding label, e.g. "River King Engine — v0.1.0". */
  protected readonly versionLabel = `River King Engine — v${APP_VERSION}`;
```

In `src/app/app.component.html`, replace:

```html
<span>River King Engine</span>
```

with:

```html
<span data-testid="status-version">{{ versionLabel }}</span>
```

- [ ] **Step 7: Run to verify it passes**

Run: `devbox run npx ng test --watch=false --include='**/app.spec.ts'`
Expected: ALL PASS (8 existing + 1 new = 9). The existing test asserting `footer?.textContent` contains `River King Engine` keeps passing.

- [ ] **Step 8: Verify the production build accepts the JSON import**

Run: `devbox run npm run build`
Expected: `Application bundle generation complete.` — esbuild inlines `version`; no bundle budget regression.

- [ ] **Step 9: Full verification**

Run: `devbox run npm run test` → all green (495 tests).
Run: `devbox run npm run lint` → `All files pass linting.`
Run: `devbox run npm run format:check` → `All matched files use Prettier code style!` (run `npm run format` first and commit if it changes anything).

- [ ] **Step 10: Commit**

```bash
git add tsconfig.json src/app/core/app-version.ts src/app/app.ts src/app/app.component.html src/app/app.spec.ts
git commit -m "feature-74: show the app version in the status bar"
```

## Notes for the implementer

- Do NOT touch the topbar brand at `app.component.html:12`; it must stay `River King Engine`.
- Do NOT add a `v` prefix inside `APP_VERSION` — the consumer owns the prefix, so the module stays reusable for other copy.
- The em dash in `versionLabel` must be `—` (U+2014), not a hyphen and not `--`.
- `resolveJsonModule` belongs in the base `tsconfig.json` so `tsconfig.app.json` and `tsconfig.spec.json` inherit it; adding it to only one would break the other builder.
