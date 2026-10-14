# Sprite Editor Collision Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn per-pixel collision painting in the sprite editor into a first-class _mode_ toggled from a canvas overlay toolbar, reusing the brush/eraser/fill tools, and let an empty (all-zero) mask be saved so a blocking tile can be made fully passable.

**Architecture:** Collision mode is feature-level state owned by `SpriteEditorComponent`. The overlay toolbar (grid · collision · reset) lives in the parent template, over the canvas — mirroring the scene editor toolbar and honouring the repo's "no child → parent app actions" rule. `PixelCanvasComponent` gains a `collisionMode` input that reinterprets the drawing tools as mask operations and gates the red overlay. `DrawingToolsComponent` drops the two collision buttons and hides the Anchor tool while the mode is active. Storage collapses only a _fully solid_ mask to `null`; an all-zero mask is preserved.

**Tech Stack:** Angular 22 (standalone, signals, OnPush), TypeScript, Tailwind (`tw-`), Vitest + jsdom, Dexie.

**Spec:** `docs/superpowers/specs/2026-10-15-sprite-editor-collision-mode-design.md`

---

## Global constraints

- Run all commands through `devbox run`.
- Never inline templates; keep SCSS in the sibling files.
- Tailwind prefix `tw-`; theme tokens only. Icons are Material Symbols.
- OnPush + signal inputs/outputs; keep `templateUrl`/`styleUrl`.
- Do NOT touch `collision.ts` / the runtime (already treats an all-zero mask as passable).
- Keep the pre-existing `resolveCollision`/`buildBlockingGrid` tests green.
- Keep `PROJECT_ARCHIVE_VERSION` at `1`.

---

### Task 1: Drawing tools — drop collision tools, hide Anchor in collision mode

**Files:**

- Modify: `src/app/features/sprite-editor/tools/drawing-tools.component.ts`
- Modify: `src/app/features/sprite-editor/tools/drawing-tools.component.html`
- Test: `src/app/features/sprite-editor/tools/drawing-tools.component.spec.ts`

**Interfaces:**

- Produces: `DrawingToolsComponent.collisionMode = input(false)`.
- The `DrawingTool` union is **not** changed in this task (removed in Task 3 once all consumers stop referencing `'collision' | 'collisionErase'`).

- [ ] **Step 1: Add the failing tests**

Append to `drawing-tools.component.spec.ts` (before the closing `});`):

```ts
it('does not render the collision tool buttons', () => {
  fixture.componentRef.setInput('tool', 'brush');
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[data-testid="tool-collision"]')).toBeNull();
  expect(fixture.nativeElement.querySelector('[data-testid="tool-collision-erase"]')).toBeNull();
});

it('hides the anchor tool while collision mode is on', () => {
  fixture.componentRef.setInput('tool', 'brush');
  fixture.componentRef.setInput('collisionMode', true);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[data-testid="tool-anchor"]')).toBeNull();
  expect(fixture.nativeElement.querySelector('[data-testid="tool-brush"]')).toBeTruthy();
});
```

- [ ] **Step 2: Run the tests (expect failure)**

Run: `devbox run npx ng test --watch=false --include='**/drawing-tools.component.spec.ts'`
Expected: FAIL — `collisionMode` input unknown / collision buttons still present.

- [ ] **Step 3a: Add the input**

In `drawing-tools.component.ts`, after `selectedTool`… actually after `tool` add:

```ts
/** Whether the sprite editor is in collision-mask painting mode. */
collisionMode = input(false);
```

Update the class JSDoc line 9 to: `Provides buttons for brush, eraser, fill, and anchor tools.`

- [ ] **Step 3b: Update the template**

In `drawing-tools.component.html`:

1. Wrap the existing anchor `<button>` (lines 41-51) in `@if (!collisionMode()) { ... }`.
2. Delete the two `<button>` blocks for `data-testid="tool-collision"` and `data-testid="tool-collision-erase"` (lines 52-73).

- [ ] **Step 4: Run the tests (expect pass)**

Run: `devbox run npx ng test --watch=false --include='**/drawing-tools.component.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/sprite-editor/tools/drawing-tools.component.ts src/app/features/sprite-editor/tools/drawing-tools.component.html src/app/features/sprite-editor/tools/drawing-tools.component.spec.ts
git commit -m "feature-105: drop the collision tool buttons and hide Anchor in collision mode"
```

---

### Task 2: Pixel canvas — collision-mode mask painting

**Files:**

- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.ts`
- Test: `src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts`

**Interfaces:**

- Consumes: existing `collisionMask` input, `collisionMaskChange` output.
- Produces: `PixelCanvasComponent.collisionMode = input(false)`. When on: brush → mask `1`, eraser → mask `0`, fill → flood-fill the mask with `1`; the red overlay is drawn and the ground-zone marker is suppressed.

- [ ] **Step 1: Replace the collision tests**

In `pixel-canvas.component.spec.ts`, delete the two tests `'paints solid collision pixels with the collision tool'` and `'clears collision pixels with the erase tool'` (the ones dispatching with `tool: 'collision'` / `'collisionErase'`), and add:

```ts
it('paints solid mask pixels with the brush in collision mode', () => {
  setupInputs(Array.from({ length: 2 }, () => Array(2).fill(0)));
  fixture.componentRef.setInput('collisionMode', true);
  fixture.detectChanges();
  const spy = vi.fn();
  fixture.componentInstance.collisionMaskChange.subscribe(spy);

  const canvas = fixture.nativeElement.querySelector('canvas');
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 256,
    height: 256,
  } as DOMRect);

  canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 4, clientY: 4, bubbles: true }));
  canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

  const emitted = spy.mock.calls.at(-1)?.[0] as number[][];
  expect(emitted[0][0]).toBe(1);
});

it('erases mask pixels with the eraser in collision mode', () => {
  setupInputs(Array.from({ length: 2 }, () => Array(2).fill(0)));
  fixture.componentRef.setInput('collisionMask', [
    [1, 1],
    [1, 1],
  ]);
  fixture.componentRef.setInput('collisionMode', true);
  fixture.componentRef.setInput('tool', 'eraser');
  fixture.detectChanges();
  const spy = vi.fn();
  fixture.componentInstance.collisionMaskChange.subscribe(spy);

  const canvas = fixture.nativeElement.querySelector('canvas');
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 256,
    height: 256,
  } as DOMRect);

  canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 4, clientY: 4, bubbles: true }));
  canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

  const emitted = spy.mock.calls.at(-1)?.[0] as number[][];
  expect(emitted[0][0]).toBe(0);
});

it('does not emit indicesChange while in collision mode', () => {
  setupInputs(Array.from({ length: 2 }, () => Array(2).fill(0)));
  fixture.componentRef.setInput('collisionMode', true);
  fixture.detectChanges();
  const spy = vi.fn();
  fixture.componentInstance.indicesChange.subscribe(spy);

  const canvas = fixture.nativeElement.querySelector('canvas');
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 256,
    height: 256,
  } as DOMRect);

  canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 4, clientY: 4, bubbles: true }));
  canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

  expect(spy).not.toHaveBeenCalled();
});

it('draws the collision overlay for solid cells in collision mode', () => {
  setupInputs(Array.from({ length: 2 }, () => Array(2).fill(0)));
  fixture.componentRef.setInput('collisionMask', [
    [1, 1],
    [1, 1],
  ]);
  fixture.componentRef.setInput('collisionMode', true);
  fixture.detectChanges();

  // cellScale = 128 for a 2x2 grid; the bottom-right overlay cell is at (128,128).
  expect(mockCtx.fillRect).toHaveBeenCalledWith(128, 128, 128, 128);
});
```

- [ ] **Step 2: Run the tests (expect failure)**

Run: `devbox run npx ng test --watch=false --include='**/pixel-canvas.component.spec.ts'`
Expected: FAIL — `collisionMode` input missing / overlay not drawn.

- [ ] **Step 3a: Add the input**

In `pixel-canvas.component.ts`, after the `collisionMask` input (line 66) add:

```ts
/** Whether the canvas is in collision-mask painting mode. */
collisionMode = input(false);
```

- [ ] **Step 3b: Track the mode for re-render**

In the constructor effect (after `this.anchor();`, ~line 149) add:

```ts
// Track collision mode so toggling it repaints the overlay.
this.collisionMode();
```

- [ ] **Step 3c: Gate the overlay on the mode**

Replace the overlay block (lines 273-284) opening lines:

```ts
    // Collision mask overlay while editing collisions.
    if (this.collisionMode() && this.localCollisionMask.length > 0) {
```

(the inner loop stays the same).

- [ ] **Step 3d: Suppress the ground-zone marker in collision mode**

Replace line 289 (`const zone = ...`) with:

```ts
const zone = this.collisionMode()
  ? null
  : this.tool() === 'anchor'
    ? (this.hoverZone() ?? this.anchor())
    : this.anchor();
```

- [ ] **Step 3e: Route painting through the mode**

Replace the whole `applyTool` method body (lines 422-452) with:

```ts
  /** @internal Dispatches the active tool for the given mouse event. */
  private applyTool(event: MouseEvent) {
    const { x, y } = this.getPixelCoordinates(event);
    if (x < 0 || x >= this.gridCols() || y < 0 || y >= this.gridRows()) return;

    if (this.collisionMode()) {
      this.applyMaskTool(x, y);
      return;
    }

    const current = this.localPaletteIndices[y][x];
    const tool = this.tool();

    if (tool === 'brush') {
      if (current !== this.selectedColorIndex()) {
        this.localPaletteIndices[y][x] = this.selectedColorIndex();
        this.emitAndRender();
      }
    } else if (tool === 'eraser') {
      if (current !== 0) {
        this.localPaletteIndices[y][x] = 0;
        this.emitAndRender();
      }
    } else if (tool === 'fill') {
      const targetColor = current;
      const fillColor = this.selectedColorIndex();
      if (targetColor === fillColor) return;
      this.floodFill(x, y, targetColor, fillColor);
      this.emitAndRender();
    }
  }

  /**
   * @internal Applies the active tool to the collision mask: brush paints solid,
   * eraser clears, fill floods solid.
   * @param x - Grid column.
   * @param y - Grid row.
   */
  private applyMaskTool(x: number, y: number) {
    const tool = this.tool();
    if (tool === 'fill') {
      const target = this.localCollisionMask[y][x];
      if (target === 1) return;
      this.floodFillMask(x, y, target, 1);
      this.emitMaskAndRender();
      return;
    }
    const value = tool === 'eraser' ? 0 : 1;
    if (this.localCollisionMask[y][x] !== value) {
      this.localCollisionMask[y][x] = value;
      this.emitMaskAndRender();
    }
  }
```

Then add `floodFillMask` next to `floodFill`:

```ts
  /**
   * @internal Stack-based flood fill over the collision mask.
   * @param startX - Starting column.
   * @param startY - Starting row.
   * @param target - Mask value to replace.
   * @param fill - Mask value to write.
   */
  private floodFillMask(startX: number, startY: number, target: number, fill: number) {
    const stack: [number, number][] = [[startX, startY]];
    const visited = new Set<string>();
    const key = (x: number, y: number) => `${x},${y}`;

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      if (x < 0 || x >= this.gridCols() || y < 0 || y >= this.gridRows()) continue;
      if (visited.has(key(x, y))) continue;
      visited.add(key(x, y));
      if (this.localCollisionMask[y][x] !== target) continue;

      this.localCollisionMask[y][x] = fill;

      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }
  }
```

- [ ] **Step 4: Run the tests (expect pass)**

Run: `devbox run npx ng test --watch=false --include='**/pixel-canvas.component.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/sprite-editor/canvas/pixel-canvas.component.ts src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts
git commit -m "feature-105: paint the collision mask through the canvas collision mode"
```

---

### Task 3: Sprite editor — toolbar, mode state, mask semantics

**Files:**

- Modify: `src/app/features/sprite-editor/tools/drawing-tools.component.ts` (shrink the union)
- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.html` (remove the grid button — moved to the parent)
- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts` (drop the two grid-button tests)
- Modify: `src/app/features/sprite-editor/sprite-editor.component.ts`
- Modify: `src/app/features/sprite-editor/sprite-editor.component.html`
- Test: `src/app/features/sprite-editor/sprite-editor.component.spec.ts`

**Interfaces:**

- Consumes: `DrawingToolsComponent.collisionMode`, `PixelCanvasComponent.collisionMode`.
- Produces: `SpriteEditorComponent.collisionMode` signal, `showGrid` computed, `pixelCanvasRef` viewChild, `toggleCollisionMode()`, and corrected mask commit/reset semantics.

- [ ] **Step 1: Write the failing tests**

In `sprite-editor.component.spec.ts`, **replace** the existing `'persists a painted collision mask and resets it to null'` test with the following block (the fixtures for tile 1 / sprite 11 are reused):

```ts
it('persists a painted collision mask and resets the visibility to full', async () => {
  await createProjectWithPalette();
  const db = TestBed.inject(DatabaseService);
  await db.tiles.add({
    id: 1,
    projectId: 'test-proj',
    name: 'Wall',
    type: 'static',
    spriteIds: [11],
    animationSpeed: 4,
    properties: { blocking: true, interactable: false, ySort: false },
  } as Tile);
  await db.sprites.add({
    id: 11,
    projectId: 'test-proj',
    tileId: 1,
    name: 'Wall 1',
    width: 2,
    height: 2,
    pixelData: '',
    paletteIndices: [],
  } as Sprite);
  await setupWithProject();
  await flushRouteWork();
  fixture.detectChanges();
  const component = fixture.componentInstance;
  await component.selectSprite(11);

  component.toggleCollisionMode();
  expect(component.collisionMode()).toBe(true);
  expect(component.collisionMask()).toEqual([
    [1, 1],
    [1, 1],
  ]);

  component.onStrokeStart();
  component.onCollisionMaskChange([
    [1, 0],
    [0, 0],
  ]);
  component.onStrokeEnd([
    [0, 0],
    [0, 0],
  ]);
  await new Promise((r) => setTimeout(r, 50));

  expect((await db.tiles.get(1))!.collisionMask).toEqual([
    [1, 0],
    [0, 0],
  ]);

  await component.onResetCollisionMask();
  expect(component.collisionMask()).toEqual([
    [1, 1],
    [1, 1],
  ]);
  expect((await db.tiles.get(1))!.collisionMask).toBeNull();
});

it('persists an all-zero mask so a blocking tile becomes fully passable', async () => {
  await createProjectWithPalette();
  const db = TestBed.inject(DatabaseService);
  await db.tiles.add({
    id: 1,
    projectId: 'test-proj',
    name: 'Wall',
    type: 'static',
    spriteIds: [11],
    animationSpeed: 4,
    properties: { blocking: true, interactable: false, ySort: false },
  } as Tile);
  await db.sprites.add({
    id: 11,
    projectId: 'test-proj',
    tileId: 1,
    name: 'Wall 1',
    width: 2,
    height: 2,
    pixelData: '',
    paletteIndices: [],
  } as Sprite);
  await setupWithProject();
  await flushRouteWork();
  fixture.detectChanges();
  const component = fixture.componentInstance;
  await component.selectSprite(11);

  component.toggleCollisionMode();
  component.onStrokeStart();
  component.onCollisionMaskChange([
    [0, 0],
    [0, 0],
  ]);
  component.onStrokeEnd([
    [0, 0],
    [0, 0],
  ]);
  await new Promise((r) => setTimeout(r, 50));

  expect((await db.tiles.get(1))!.collisionMask).toEqual([
    [0, 0],
    [0, 0],
  ]);
});

it('hides the palette and reports Collision in the status bar in collision mode', async () => {
  await createProjectWithPalette();
  const db = TestBed.inject(DatabaseService);
  await db.tiles.add({
    id: 1,
    projectId: 'test-proj',
    name: 'Wall',
    type: 'static',
    spriteIds: [11],
    animationSpeed: 4,
    properties: { blocking: true, interactable: false, ySort: false },
  } as Tile);
  await db.sprites.add({
    id: 11,
    projectId: 'test-proj',
    tileId: 1,
    name: 'Wall 1',
    width: 2,
    height: 2,
    pixelData: '',
    paletteIndices: [],
  } as Sprite);
  await setupWithProject();
  await flushRouteWork();
  fixture.detectChanges();
  const component = fixture.componentInstance;
  await component.selectSprite(11);

  component.toggleCollisionMode();
  fixture.detectChanges();

  const compiled = fixture.nativeElement as HTMLElement;
  expect(compiled.querySelector('rk-palette-manager')).toBeNull();
  expect(statusBarSpy).toHaveBeenCalledWith(expect.stringContaining('Collision'));
});
```

> Adapt `createProjectWithPalette`, `setupWithProject`, `flushRouteWork`, and `statusBarSpy` to the helpers/spies already present in this spec (the status-bar spy used by the other status-bar tests).

- [ ] **Step 2: Run the tests (expect failure)**

Run: `devbox run npx ng test --watch=false --include='**/sprite-editor.component.spec.ts'`
Expected: FAIL — `toggleCollisionMode` / `collisionMode` do not exist.

- [ ] **Step 3a: Shrink the tool union**

In `drawing-tools.component.ts`:

```ts
/** Supported drawing tool identifiers for the sprite canvas. */
export type DrawingTool = 'brush' | 'eraser' | 'fill' | 'anchor';
```

- [ ] **Step 3b: Update `TOOL_LABELS` and add the mode state**

In `sprite-editor.component.ts`, replace `TOOL_LABELS` (lines 41-48):

```ts
const TOOL_LABELS: Record<DrawingTool, string> = {
  brush: 'Brush',
  eraser: 'Eraser',
  fill: 'Fill',
  anchor: 'Anchor',
};
```

Add next to `collisionMask` (after line 132):

```ts
  /** Whether the canvas is editing the current tile's collision mask. */
  readonly collisionMode = signal(false);

  /** Reference to the pixel canvas so the toolbar can drive its grid toggle. */
  private readonly pixelCanvasRef = viewChild(PixelCanvasComponent);

  /** Whether the pixel grid is shown (mirrored from the canvas for the toolbar). */
  readonly showGrid = computed(() => this.pixelCanvasRef()?.showGrid() ?? true);
```

> `PixelCanvasComponent` is already imported (line 18) and already referenced in `imports`. `viewChild` is already imported.

- [ ] **Step 3c: Add mode / mask helpers**

Add near the collision handlers (before `commitCollisionMask`):

```ts
  /** Toggles collision-mask painting; entering initialises a full mask. */
  toggleCollisionMode(): void {
    const next = !this.collisionMode();
    this.collisionMode.set(next);
    if (!next) return;
    if (this.selectedTool() === 'anchor') this.selectedTool.set('brush');
    if (!this.collisionMask()) this.collisionMask.set(this.buildFullMask());
  }

  /**
   * @internal A full (all-solid) mask matching the current sprite grid.
   * @returns A rows×cols grid of `1`.
   */
  private buildFullMask(): number[][] {
    const indices = this.paletteIndices();
    const rows = indices?.length ?? 0;
    const cols = rows > 0 ? Math.max(...indices!.map((row) => row.length)) : 0;
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 1));
  }

  /**
   * @internal Whether every mask cell is solid.
   * @param mask - The mask grid to inspect.
   * @returns True when no cell is empty.
   */
  private isFullMask(mask: number[][]): boolean {
    return mask.every((row) => row.every((v) => v >= 1));
  }

  /**
   * @internal Canonical stored value for a working mask: `null` when the mask is
   * full (the default footprint), otherwise the mask itself — including an
   * all-zero mask, which is persisted so a blocking tile can be made passable.
   * @param mask - The working mask, or null.
   * @returns The value to persist.
   */
  private storedFromMask(mask: number[][] | null): number[][] | null {
    return mask && !this.isFullMask(mask) ? mask : null;
  }
```

- [ ] **Step 3d: Use the mode for stroke routing and commit semantics**

Replace `onStrokeStart` (lines 487-490 branch) with:

```ts
  onStrokeStart(): void {
    if (this.collisionMode()) {
      this.collisionStrokeActive = true;
      this.previousCollisionMask = this.collisionMask()?.map((row) => [...row]) ?? null;
      return;
    }
    this.previousIndices = this.paletteIndices()?.map((row) => [...row]) ?? null;
  }
```

Replace the `onStrokeEnd` guard (lines 501-504) with:

```ts
if (this.collisionMode()) {
  void this.commitCollisionMask();
  return;
}
```

In `commitCollisionMask`, replace lines 552-554:

```ts
const next = this.storedFromMask(this.collisionMask());
const prev = this.storedFromMask(previous);
```

Replace `onResetCollisionMask` (lines 572-590) with:

```ts
  async onResetCollisionMask(): Promise<void> {
    const tile = this.currentTile();
    if (!tile) return;
    const prevStored = this.storedFromMask(this.collisionMask());
    try {
      await this.tileService.updateTile(tile.id, { collisionMask: null });
      this.collisionMask.set(this.buildFullMask());
      await this.loadTiles();
      if (prevStored) {
        this.undo.push({
          label: 'Reset collision mask',
          execute: () => void this.tileService.updateTile(tile.id, { collisionMask: null }),
          undo: () => void this.tileService.updateTile(tile.id, { collisionMask: prevStored }),
        });
      }
    } catch {
      this.notification.error('Failed to reset the collision mask.');
    }
  }
```

Delete `maskHasSolid` (lines 592-599) — no longer referenced.

- [ ] **Step 3e: Exit collision mode on selection**

In `selectTile` (after line 413) and in `selectSprite` (after `this.onionPanelOpen.set(false);`), add:

```ts
this.collisionMode.set(false);
```

- [ ] **Step 3f: Status bar**

In `statusBarEffect`, replace line 273:

```ts
const tool = this.collisionMode() ? 'Collision' : TOOL_LABELS[this.selectedTool()];
```

and line 274:

```ts
const colorSegment = this.collisionMode() ? '' : ` | Color #${colorNumber}`;
```

Then update the final concatenation (line 286) to use `${colorSegment}`:

```ts
      `${sprite.name} | ${sprite.width}×${sprite.height} px | ${tool}${colorSegment} | Zoom ${zoomPercent}${frameStr}${anchorSuffix}`,
```

- [ ] **Step 3g: Template — remove the old Reset block, add the toolbar, hide the palette**

In `sprite-editor.component.html`:

1. Remove the `@if (selectedTool() === 'collision' || selectedTool() === 'collisionErase') { ... Reset ... }` block (lines 170-193).
2. Add the toolbar overlay inside `#onionAnchor`, right after the `<rk-pixel-canvas ... />` element (line 71):

```html
<div class="tw-absolute tw-top-1 tw-right-1 tw-z-10 tw-flex tw-items-center tw-gap-1">
  <button
    type="button"
    data-testid="toggle-grid"
    (click)="pixelCanvasRef()?.toggleGrid()"
    [attr.aria-label]="showGrid() ? 'Hide grid' : 'Show grid'"
    [title]="showGrid() ? 'Hide grid' : 'Show grid'"
    class="tw-flex tw-items-center tw-justify-center tw-w-6 tw-h-6 tw-rounded-sm tw-bg-card-bg tw-border tw-border-border tw-text-foreground tw-cursor-pointer hover:tw-bg-accent"
  >
    <span class="material-symbols tw-text-sm" aria-hidden="true"
      >{{ showGrid() ? 'grid_on' : 'grid_off' }}</span
    >
  </button>
  <button
    type="button"
    data-testid="toggle-collision-mode"
    (click)="toggleCollisionMode()"
    [attr.aria-pressed]="collisionMode()"
    [class.tw-bg-primary/10]="collisionMode()"
    [class.tw-border-primary]="collisionMode()"
    title="Edit collision mask"
    class="tw-flex tw-items-center tw-justify-center tw-w-6 tw-h-6 tw-rounded-sm tw-bg-card-bg tw-border tw-border-border tw-text-foreground tw-cursor-pointer hover:tw-bg-accent"
  >
    <span class="material-symbols tw-text-sm" aria-hidden="true">block</span>
  </button>
  @if (collisionMode()) {
  <button
    type="button"
    data-testid="reset-collision-mask"
    (click)="onResetCollisionMask()"
    title="Reset collision mask to full footprint"
    class="tw-px-2 tw-h-6 tw-text-xs tw-rounded-sm tw-border tw-border-border tw-bg-card-bg tw-text-foreground tw-cursor-pointer hover:tw-bg-accent"
  >
    Reset
  </button>
  }
</div>
```

Pass the mode into the canvas and the tools, and hide the palette:

- On `rk-pixel-canvas` (after the `[collisionMask]` binding, line 69-70), add:

```html
[collisionMode]="collisionMode()"
```

- Wrap `<rk-palette-manager ... />` (lines 224-228) in `@if (!collisionMode()) { ... }`.
- Pass the mode into the tools (line 229):

```html
<rk-drawing-tools
  [tool]="selectedTool()"
  [collisionMode]="collisionMode()"
  (toolChange)="selectedTool.set($event)"
/>
```

- [ ] **Step 3h: Remove the grid button from the canvas**

In `pixel-canvas.component.html`, delete the grid `<button>` (lines 7-21), leaving only the `<canvas>` inside the wrapper `<div>`.

In `pixel-canvas.component.spec.ts`, delete the two tests `'renders a floating grid toggle button reflecting the showGrid state'` and `'toggles the grid when the floating button is clicked'` (the grid signal tests `defaults to showing…`, `restores…`, `persists...`, and `toggleGrid flips…` stay).

- [ ] **Step 4: Run the tests (expect pass)**

Run: `devbox run npx ng test --watch=false --include='**/sprite-editor.component.spec.ts' --include='**/pixel-canvas.component.spec.ts' --include='**/drawing-tools.component.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/sprite-editor
git commit -m "feature-105: edit collision masks as a canvas mode in the sprite editor"
```

---

## Final verification

- [ ] `devbox run npm run test` — full suite green (baseline 55 files / 647 tests).
- [ ] `devbox run npm run lint` — no errors.
- [ ] `devbox run npm run format:check` — clean (run `devbox run npx prettier --write <files>` if needed).
- [ ] `devbox run npm run build` — production build succeeds.
