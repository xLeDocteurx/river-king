# Sprite Editor Grid Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating button over the sprite pixel canvas that toggles grid visibility, persisted per browser session.

**Architecture:** `PixelCanvasComponent` already owns grid rendering; add a `showGrid` signal persisted to `sessionStorage` (mirroring the scene editor's `map-canvas` grid toggle), skip the grid pass when hidden, and add a floating Material-Symbol toggle button in the component's own template, co-located with the canvas.

**Tech Stack:** Angular 22 standalone components, signals, Tailwind (`tw-` prefix), Vitest/jsdom unit tests, Material Symbols font.

## Global Constraints

- Tailwind classes must use the `tw-` prefix.
- No inline templates — separate `.html` / `.scss` via `templateUrl` / `styleUrl`.
- Every public method needs JSDoc; class needs JSDoc.
- OnPush change detection; signals preferred for state.
- No hardcoded hex colors in templates — use theme tokens (`tw-bg-card-bg`, `tw-border-border`, `tw-text-foreground`, `hover:tw-bg-accent`).
- English UI copy only.
- Run tests/lint via `devbox run npm run test` and `devbox run npm run lint` (bare `npm` may fail over WSL UNC paths).
- The existing spec test file mocks the canvas 2D context — reuse `createMockCanvasContext()`.
- `sessionStorage` key must not clash with the scene editor's `GRID_VISIBLE_STORAGE_KEY` (`rk-scene-editor.show-grid`).

---

### Task 1: Grid visibility signal + persistence + render gate

**Files:**
- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.ts` (signal + export near top, persistence effect in constructor, render gate around grid draw at line ~221)
- Test: `src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `export const GRID_VISIBLE_STORAGE_KEY = 'rk-sprite-editor.show-grid';`
  - `readonly showGrid = signal(this.readGridVisibility());` on `PixelCanvasComponent`.
  - private `readGridVisibility(): boolean`
  - `toggleGrid(): void` (public, used by the button in Task 2).

- [ ] **Step 1: Write the failing test**

Add these tests to `pixel-canvas.component.spec.ts`. First update the import to bring in the key:

```ts
import { PixelCanvasComponent, GRID_VISIBLE_STORAGE_KEY } from './pixel-canvas.component';
```

Then add, inside `describe('PixelCanvasComponent', ...)` before the closing `});`:

```ts
it('defaults to showing the grid when no session preference is stored', () => {
  setupInputs([[0]]);
  expect(fixture.componentInstance.showGrid()).toBe(true);
});

it('restores the grid visibility from the session when hidden', () => {
  sessionStorage.setItem(GRID_VISIBLE_STORAGE_KEY, '0');
  setupInputs([[0]]);
  expect(fixture.componentInstance.showGrid()).toBe(false);
});

it('persists grid visibility changes to the session storage', async () => {
  setupInputs([[0]]);
  const instance = fixture.componentInstance;
  instance.showGrid.set(false);
  await new Promise((r) => setTimeout(r, 50));
  expect(sessionStorage.getItem(GRID_VISIBLE_STORAGE_KEY)).toBe('0');
  instance.showGrid.set(true);
  await new Promise((r) => setTimeout(r, 50));
  expect(sessionStorage.getItem(GRID_VISIBLE_STORAGE_KEY)).toBe('1');
});

it('toggleGrid flips the showGrid signal and persists it', async () => {
  setupInputs([[0]]);
  const instance = fixture.componentInstance;
  expect(instance.showGrid()).toBe(true);
  instance.toggleGrid();
  await new Promise((r) => setTimeout(r, 50));
  expect(instance.showGrid()).toBe(false);
  expect(sessionStorage.getItem(GRID_VISIBLE_STORAGE_KEY)).toBe('0');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npm run test -- --include **/pixel-canvas.component.spec.ts`
Expected: FAIL — `GRID_VISIBLE_STORAGE_KEY` and `toggleGrid` are not defined on the module/component.

- [ ] **Step 3: Write minimal implementation**

In `pixel-canvas.component.ts`, add the export near the top of the file (after imports):

```ts
/** Session storage key used to persist the sprite canvas grid visibility. */
export const GRID_VISIBLE_STORAGE_KEY = 'rk-sprite-editor.show-grid';
```

Inside the class, add the signal near the other signals (e.g. after `zoom`):

```ts
/** Whether the pixel grid is drawn over the sprite. Defaults to on (visible). */
readonly showGrid = signal(this.readGridVisibility());
```

Add the persistence effect to the existing constructor (after the `effect` that loads indices and onion skins):

```ts
/** Persist the grid visibility choice for the current browser session. */
effect(() => {
  sessionStorage.setItem(GRID_VISIBLE_STORAGE_KEY, this.showGrid() ? '1' : '0');
});
```

Add the public toggle and private reader methods (e.g. after `loadOnionSkinImages`):

```ts
/** Toggles whether the pixel grid is drawn over the sprite. */
toggleGrid(): void {
  this.showGrid.update((v) => !v);
  this.render();
}

/**
 * Reads the stored grid visibility for the current session.
 * @returns True unless the session explicitly stores '0'; missing values default to visible.
 */
private readGridVisibility(): boolean {
  return sessionStorage.getItem(GRID_VISIBLE_STORAGE_KEY) !== '0';
}
```

Gate the grid draw pass in `render()`. Change the existing line

```ts
if (zoom * scale >= 8) {
```

to

```ts
if (this.showGrid() && zoom * scale >= 8) {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devbox run npm run test -- --include **/pixel-canvas.component.spec.ts`
Expected: PASS (all PixelCanvasComponent tests, including the 4 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/sprite-editor/canvas/pixel-canvas.component.ts src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts
git commit -m "feature-40: add grid visibility signal + session persistence to pixel canvas"
```

---

### Task 2: Floating grid toggle button over the canvas

**Files:**
- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.html` (wrap canvas in a relative container, add floating button)
- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.scss` (nothing required; inline Tailwind used — verify existing SCSS)
- Test: `src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts`

**Interfaces:**
- Consumes: `GRID_VISIBLE_STORAGE_KEY` and `showGrid`/`toggleGrid` from Task 1.
- Produces: a rendered `button[aria-label]` in the component template wired to `toggleGrid()`.

- [ ] **Step 1: Write the failing test**

Add to `pixel-canvas.component.spec.ts` inside `describe(...)`:

```ts
it('renders a floating grid toggle button reflecting the showGrid state', () => {
  setupInputs([[0]]);
  const btn: HTMLButtonElement | null = fixture.nativeElement.querySelector('button');
  expect(btn).toBeTruthy();
  expect(btn.getAttribute('aria-label')).toBe('Hide grid');
});

it('toggles the grid when the floating button is clicked', async () => {
  setupInputs([[0]]);
  const btn: HTMLButtonElement | null = fixture.nativeElement.querySelector('button');
  btn!.click();
  await new Promise((r) => setTimeout(r, 50));
  expect(fixture.componentInstance.showGrid()).toBe(false);
  expect(sessionStorage.getItem(GRID_VISIBLE_STORAGE_KEY)).toBe('0');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npm run test -- --include **/pixel-canvas.component.spec.ts`
Expected: FAIL — `querySelector('button')` returns null (no button in template yet).

- [ ] **Step 3: Write minimal implementation**

Replace the entire contents of `pixel-canvas.component.html` with:

```html
<div class="tw-relative tw-inline-block">
  <canvas
    #canvas
    class="tw-cursor-crosshair tw-block"
    (mousedown)="onMouseDown($event)"
    (mousemove)="onMouseMove($event)"
    (mouseup)="onMouseUp()"
    (mouseleave)="onMouseLeave()"
    (wheel)="onWheel($event)"
  ></canvas>
  <button
    type="button"
    (click)="toggleGrid()"
    [attr.aria-label]="showGrid() ? 'Hide grid' : 'Show grid'"
    [title]="showGrid() ? 'Hide grid' : 'Show grid'"
    class="tw-absolute tw-top-1 tw-right-1 tw-z-10 tw-flex tw-items-center tw-justify-center tw-w-6 tw-h-6 tw-rounded-sm tw-bg-card-bg tw-border tw-border-border tw-text-foreground tw-cursor-pointer hover:tw-bg-accent"
  >
    <span class="material-symbols tw-text-sm" aria-hidden="true">{{
      showGrid() ? 'grid_on' : 'grid_off'
    }}</span>
  </button>
</div>
```

Note the canvas is centered in the parent via flexbox; adding a wrapper `inline-block` keeps it tight around the canvas so the button overlays its top-right corner without the button spanning the full column width.

- [ ] **Step 4: Run test to verify it passes**

Run: `devbox run npm run test -- --include **/pixel-canvas.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/sprite-editor/canvas/pixel-canvas.component.html src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts
git commit -m "feature-40: add floating grid toggle button to sprite pixel canvas"
```

---

## Self-Review (performed by plan author)

- **Spec coverage:** The spec requires (a) a `showGrid` signal persisted in `sessionStorage` → Task 1; (b) a floating Material Symbol button reflecting state → Task 2; (c) skipping grid when hidden → Task 1 render gate; (d) co-location of control with canvas → Task 2 puts the button in `pixel-canvas.component.html`. All covered.
- **Placeholder scan:** No TODOs or vague steps; every code step has full code and exact commands.
- **Key naming:** `GRID_VISIBLE_STORAGE_KEY` defined in Task 1 export and used in Task 2 imports — matches. `showGrid`, `toggleGrid`, `readGridVisibility` used consistently across both tasks.
- **Note on rendering in Task 1 gate:** The render gate test is behavioral via button/state; the actual grid-draw assertion is covered indirectly (existing tests already run the render with the gate; when `showGrid()` defaults true the existing behavior is preserved). This matches the scene-editor precedent where tests assert the signal/key rather than canvas pixels.
