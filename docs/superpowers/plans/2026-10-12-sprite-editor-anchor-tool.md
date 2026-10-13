# Sprite-editor Anchor Tool (#93) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a sprite artist set a tile's `ts×ts` ground zone (the anchor) from the sprite editor: a new **Anchor** tool with a grid-snapped hover highlight and click-to-set, an **Auto** button that clears it back to the derived bottom-center, and a status-bar readout.

**Architecture:** Add `'anchor'` to the `DrawingTool` union and a toolbar button. `PixelCanvasComponent` gains `tileSize` + `anchor` inputs and an `anchorChange` output; when the anchor tool is active it snaps the pointer to the `ts` grid, renders a highlight, and emits on click (no painting). With any other tool, a stored anchor is drawn as a subtle outline. `SpriteEditorComponent` wires the active tile's anchor through, clamps it, persists via `TileService.updateTile`, offers **Auto**, and surfaces the anchor in the status bar.

**Tech Stack:** Angular 22 (standalone, signals, OnPush), Vitest via `@angular/build:unit-test`, Tailwind `tw-` tokens, Material Symbols.

**Depends on:** #92 (Spec A) merged — provides `TileAnchor`, `deriveAnchor`, `clampAnchor`, and `Tile.anchor`.

## Global Constraints

- Angular 22 standalone components only; `ChangeDetectionStrategy.OnPush`; signals-first.
- Tailwind: `tw-` prefix, theme tokens only (never raw hex), max radius `tw-rounded-sm`. UI copy **English only**.
- Material Symbols only (`center_focus_strong` for the tool).
- Every new public method/member gets a JSDoc block.
- Tests await async DB work with a manual flush (`await new Promise(r => setTimeout(r, 50))`).
- Commands run through devbox; strip devbox noise with `grep -v "devbox|Welcome|Node.js version|npm version|^$|Running script|v22|10.9"`.
- Branch: `feature-93` (branched from `develop` **after** #92 merged). Commit messages prefixed `feature-93:`.
- Never inline templates; `pixel-canvas` keeps `templateUrl`/`styleUrl`.

---

## File structure

- Modify: `src/app/features/sprite-editor/tools/drawing-tools.component.ts` + `.html` + `.spec.ts` — add `'anchor'`.
- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.ts` + `.html` + `.spec.ts` — anchor inputs/output + snapping render.
- Modify: `src/app/features/sprite-editor/sprite-editor.component.ts` + `.html` + `.spec.ts` — wiring, Auto button, status bar.

---

### Task 1: Add the Anchor tool to the toolbar

**Files:**

- Modify: `src/app/features/sprite-editor/tools/drawing-tools.component.ts:4`
- Modify: `src/app/features/sprite-editor/tools/drawing-tools.component.html`
- Test: `src/app/features/sprite-editor/tools/drawing-tools.component.spec.ts`

**Interfaces:**

- Produces: `DrawingTool = 'brush' | 'eraser' | 'fill' | 'anchor'`.
- Produces: a `[data-testid="tool-anchor"]` button that emits `'anchor'`.

- [ ] **Step 1: Write the failing tests**

In `src/app/features/sprite-editor/tools/drawing-tools.component.spec.ts`, add (mirroring the existing `tool-fill` test):

```ts
it('should emit anchor tool on anchor button click', () => {
  fixture.componentRef.setInput('tool', 'brush');
  fixture.detectChanges();
  const spy = vi.fn();
  fixture.componentInstance.toolChange.subscribe(spy);

  const anchorBtn = fixture.nativeElement.querySelector('[data-testid="tool-anchor"]');
  anchorBtn.click();
  expect(spy).toHaveBeenCalledWith('anchor');
});

it('should highlight the anchor tool when active', () => {
  fixture.componentRef.setInput('tool', 'anchor');
  fixture.detectChanges();
  const anchorBtn = fixture.nativeElement.querySelector('[data-testid="tool-anchor"]');
  expect(anchorBtn.classList.contains('tw-bg-primary/10')).toBe(true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
devbox run npx ng test --watch=false --include='**/drawing-tools.component.spec.ts'
```

Expected: FAIL — `'anchor'` is not assignable to `DrawingTool`; no `tool-anchor` element.

- [ ] **Step 3: Implement**

In `src/app/features/sprite-editor/tools/drawing-tools.component.ts`:

```ts
/** Supported drawing tool identifiers for the sprite canvas. */
export type DrawingTool = 'brush' | 'eraser' | 'fill' | 'anchor';
```

Update the class JSDoc to mention the anchor tool. In the template, add a fourth button after the fill button, using the **exact same** class string and structure as the existing buttons (read `drawing-tools.component.html` and copy the fill button, changing `data-testid="tool-fill"` → `"tool-anchor"`, `title="Anchor"`, the icon `<span class="material-symbols ...">center_focus_strong</span>`, and the click handler to `selectTool('anchor')`).

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
devbox run npx ng test --watch=false --include='**/drawing-tools.component.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
devbox run npm run lint
git add src/app/features/sprite-editor/tools/drawing-tools.component.ts src/app/features/sprite-editor/tools/drawing-tools.component.html src/app/features/sprite-editor/tools/drawing-tools.component.spec.ts
git commit -m "feature-93: add the anchor tool to the drawing toolbar"
```

---

### Task 2: Anchor input/output + snapped preview in `pixel-canvas.component.ts`

**Files:**

- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.ts`
- Test: `src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts`

**Interfaces:**

- Consumes: `TileAnchor` from `../../../shared/models/tile-anchor`.
- Produces: `tileSize = input<number>(16)`, `anchor = input<TileAnchor | null>(null)`, `anchorChange = output<TileAnchor>()`.
- Produces: when `tool() === 'anchor'`, `onMouseDown` emits a grid-snapped, frame-clamped anchor and does not paint; a `ts×ts` highlight follows the pointer on hover; when `tool() !== 'anchor'` and `anchor()` is non-null, a subtle outline marks the stored zone.

- [ ] **Step 1: Write the failing tests**

In `src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts` (which already stubs `getContext`, `sessionStorage`, and `Image`), add:

```ts
it('emits a grid-snapped anchor when the anchor tool is clicked', () => {
  const fixture = setupInputs({ rows: 32, cols: 32, tool: 'anchor', tileSize: 16 });
  const spy = vi.fn();
  fixture.componentInstance.anchorChange.subscribe(spy);

  // canvas rect 256x256, effective scale = cellScale * zoom = 8
  fixture.componentInstance.onMouseDown(mouse(240, 320)); // pixel (30, 40)

  expect(spy).toHaveBeenCalledWith({ x: 16, y: 16 });
});

it('does not emit indicesChange while the anchor tool is active', () => {
  const { componentInstance } = makeCanvas({ tool: 'anchor' });
  const spy = vi.fn();
  componentInstance.indicesChange.subscribe(spy);
  fixture.componentInstance.onMouseDown(mouse(10, 10));
  expect(spy).not.toHaveBeenCalled();
});

it('renders a stored anchor outline for a non-anchor tool', () => {
  // setup with tool 'brush' and anchor { x: 16, y: 0 }
  // expect a strokeRect call at (16*scale, 0, 16*scale, 16*scale)
});
```

Adapt to the file's existing `TrackingObserver`/`TrackedCtx` mock and `setupInputs` helpers. The snapped value follows `Math.floor(px / ts) * ts`, clamped to `[0, cols - ts]` / `[0, rows - ts]`.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
devbox run npx ng test --watch=false --include='**/pixel-canvas.component.spec.ts'
```

Expected: FAIL — no `anchorChange` output; `tool` rejects `'anchor'`.

- [ ] **Step 3: Implement**

In `src/app/features/sprite-editor/canvas/pixel-canvas.component.ts`:

Add the import:

```ts
import type { TileAnchor } from '../../../shared/models/tile-anchor';
```

Change the tool input type (line 51):

```ts
/** Required active drawing tool. */
tool = input.required<DrawingTool>();
```

with `import { type DrawingTool } from '../tools/drawing-tools.component';` at the top (the feature-internal type import is acceptable; both are sprite-editor children).

Add inputs/outputs after `selectedColorIndex`:

```ts
  /** Side length in pixels of one map grid cell, used to snap the anchor zone. */
  tileSize = input<number>(16);

  /** Stored ground-cell anchor of the current tile, or null when derived. */
  anchor = input<TileAnchor | null>(null);

  /** Emits the snapped anchor chosen with the anchor tool. */
  anchorChange = output<TileAnchor>();

  /** @internal Snapped ground zone under the pointer while the anchor tool is active. */
  private readonly hoverZone = signal<TileAnchor | null>(null);
```

Add a tracker effect for the new inputs inside the main constructor effect (add `this.anchor(); this.tileSize();` to the tracked reads so a change re-renders).

Add the snapping helper:

```ts
  /**
   * @internal Snaps a pointer position to the `ts` grid, clamped so the ground
   * zone stays inside the frame.
   * @param event - The mouse event.
   * @returns The snapped anchor, or null when the pointer is off-canvas.
   */
  private snappedAnchor(event: MouseEvent): TileAnchor | null {
    const px = this.getPixelCoordinates(event);
    if (px.x < 0 || px.y < 0) return null;
    const ts = this.tileSize();
    const maxX = Math.max(0, this.gridCols() - ts);
    const maxY = Math.max(0, this.gridRows() - ts);
    const x = Math.min(Math.max(0, Math.floor(px.x / ts) * ts), maxX);
    const y = Math.min(Math.max(0, Math.floor(px.y / ts) * ts), maxY);
    return { x, y };
  }
```

In `onMouseDown` (line 286), branch before painting:

```ts
  onMouseDown(event: MouseEvent) {
    const ref = this.canvasRef();
    if (ref) this.rectCache = ref.nativeElement.getBoundingClientRect();
    if (this.tool() === 'anchor') {
      const snapped = this.snappedAnchor(event);
      if (snapped) {
        this.hoverZone.set(snapped);
        this.anchorChange.emit(snapped);
        this.render();
      }
      return;
    }
    this.isDrawing = true;
    this.strokeStart.emit();
    this.applyTool(event);
  }
```

In `onMouseMove` (line 300), update the hover zone and re-render instead of painting when the anchor tool is active:

```ts
  onMouseMove(event: MouseEvent) {
    if (this.tool() === 'anchor') {
      const snapped = this.snappedAnchor(event);
      this.hoverZone.set(snapped);
      this.render();
      return;
    }
    if (!this.isDrawing) return;
    this.applyTool(event);
  }
```

In `onMouseLeave`, clear the hover zone before emitting the stroke end:

```ts
  onMouseLeave() {
    this.isDrawing = false;
    this.hoverZone.set(null);
    this.strokeEnd.emit(this.localPaletteIndices.map((row) => [...row]));
    this.rectCache = null;
  }
```

In `render()` (after the pixel loop, before the grid), draw the ground-zone marker:

```ts
// Ground-zone marker: bright highlight with the anchor tool, else a subtle
// dashed outline of the stored zone so the ground cell stays visible.
const ts = this.tileSize();
const zone = this.tool() === 'anchor' ? (this.hoverZone() ?? this.anchor()) : this.anchor();
if (zone) {
  ctx.save();
  ctx.strokeStyle = this.tool() === 'anchor' ? '#ffffff' : '#555555';
  ctx.lineWidth = 1;
  ctx.setLineDash(this.tool() === 'anchor' ? [] : [3, 3]);
  ctx.strokeRect(zone.x * scale, zone.y * scale, ts * scale, ts * scale);
  ctx.restore();
}
```

The constructor effect must also read `this.tileSize()`, `this.anchor()`, and `this.hoverZone()` so a change re-renders (add these calls alongside the existing `this.paletteIndices()` reads).

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
devbox run npx ng test --watch=false --include='**/pixel-canvas.component.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
devbox run npm run lint
git add src/app/features/sprite-editor/canvas/pixel-canvas.component.ts src/app/features/sprite-editor/canvas/pixel-canvas.component.html src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts
git commit -m "feature-93: snap and preview tile anchors on the pixel canvas"
```

---

### Task 3: Wire the anchor into `sprite-editor.component.ts`

**Files:**

- Modify: `src/app/features/sprite-editor/sprite-editor.component.ts` (`TOOL_LABELS`, status-bar effect, new handlers, tile select)
- Modify: `src/app/features/sprite-editor/sprite-editor.component.html:66`
- Test: `src/app/features/sprite-editor/sprite-editor.component.spec.ts`

**Interfaces:**

- Consumes: `PixelCanvasComponent.anchor`/`tileSize`/`anchorChange` (Task 2); `clampAnchor` (Spec A); `Tile.anchor` (Spec A).
- Produces: `onAnchorChange(anchor)`, `onResetAnchor()`, `currentAnchor = computed<TileAnchor | null>`; status bar shows `Anchor — X, Y` while the tool is active.

- [ ] **Step 1: Write the failing tests**

In `src/app/features/sprite-editor/sprite-editor.component.spec.ts`, add:

```ts
it('persists a clamped anchor when the canvas emits one', async () => {
  // select a 16x32 tile, emit anchor { x: 40, y: 99 }
  // expect tileService.updateTile called with { anchor: { x: 0, y: 16 } }
});

it('clears the anchor when Auto is used', async () => {
  // click the "Auto" button (data-testid="anchor-auto")
  // expect updateTile called with { anchor: null }
});

it('shows the anchor coordinates in the status bar', () => {
  // selectedTool 'anchor', tile.anchor { x: 8, y: 16 }
  // expect statusBar.setContext called with a string containing 'Anchor'
});
```

Mock `TileService`/`StatusBarService` following the file's existing patterns.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
devbox run npx ng test --watch=false --include='**/sprite-editor.component.spec.ts'
```

Expected: FAIL — no anchor handlers.

- [ ] **Step 3: Implement**

In `src/app/features/sprite-editor/sprite-editor.component.ts`:

Add imports:

```ts
import { clampAnchor, type TileAnchor } from '../../shared/models/tile-anchor';
```

Add `anchor: 'Anchor'` to `TOOL_LABELS` (line 35-39).

Add a computed for the active tile's anchor and the handlers:

```ts
  /** Ground-cell anchor of the current tile, or null when derived (bottom-center). */
  readonly tileAnchor = computed<TileAnchor | null>(() => this.currentTile()?.anchor ?? null);

  /**
   * Persists a new ground-zone anchor for the current tile, clamped to the
   * active frame's bounds.
   * @param anchor - The anchor emitted by the pixel canvas.
   */
  async onAnchorChange(anchor: TileAnchor): Promise<void> {
    const tile = this.currentTile();
    const frame = this.selectedSprite();
    if (!tile || !frame) return;
    try {
      const clamped = clampAnchor(anchor, frame.width, frame.height, this.projectTileSize());
      await this.tileService.updateTile(tile.id, { anchor: clamped });
      await this.loadTiles();
    } catch (e) {
      console.error('Failed to save anchor:', e);
      this.notification.error('Failed to save anchor');
    }
  }

  /** Clears the current tile's anchor, restoring the derived bottom-center zone. */
  async onResetAnchor(): Promise<void> {
    const tile = this.currentTile();
    if (!tile) return;
    try {
      await this.tileService.updateTile(tile.id, { anchor: null });
      await this.loadTiles();
    } catch (e) {
      console.error('Failed to reset anchor:', e);
      this.notification.error('Failed to save anchor');
    }
  }
```

In the status-bar effect (line 246), append an anchor segment:

```ts
const anchorSuffix =
  this.selectedTool() === 'anchor'
    ? ` | Anchor — ${this.tileAnchor() ? `${this.tileAnchor()!.x}, ${this.tileAnchor()!.y}` : 'Auto'}`
    : '';
this.statusBar.setContext(
  `${sprite.name} | ${sprite.width}×${sprite.height} px | ${tool} | Color #${colorNumber} | Zoom ${zoomPercent}${frameStr}${anchorSuffix}`,
);
```

In `sprite-editor.component.html`, extend `<rk-pixel-canvas>` (line 66) with:

```html
[tileSize]="projectTileSize()" [anchor]="tileAnchor()" (anchorChange)="onAnchorChange($event)"
```

Add an **Auto** button next to the Type control (inside the `@if (currentTile(); as tile)` toolbar row at line 142), visible only in anchor mode:

```html
@if (selectedTool() === 'anchor') {
<button
  type="button"
  data-testid="auto-anchor"
  (click)="onAutoAnchor()"
  [disabled]="!tileAnchor()"
  title="Reset anchor to bottom-center"
  class="tw-px-2 tw-py-0.5 tw-text-xs tw-rounded-sm tw-border tw-border-border tw-bg-card-bg tw-text-foreground tw-cursor-pointer hover:tw-bg-accent disabled:tw-opacity-40"
>
  Auto
</button>
}
```

with the method:

```ts
  /** Resets the current tile's anchor to the derived bottom-center position. */
  async onAutoAnchor(): Promise<void> {
    const tile = this.currentTile();
    if (!tile) return;
    try {
      await this.tileService.updateTile(tile.id, { anchor: null });
      await this.loadTiles();
    } catch (e) {
      this.notification.error('Failed to save anchor');
      console.error(e);
    }
  }
```

> Implementer note: the status-bar readout and the `Auto` button are the only UI additions; no `tile-properties` change (the anchor is authored exclusively in the sprite editor).

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
devbox run npx ng test --watch=false --include='**/sprite-editor.component.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Full suite, lint, commit**

```bash
devbox run npm run test
devbox run npm run lint
git add src/app/features/sprite-editor/sprite-editor.component.ts src/app/features/sprite-editor/sprite-editor.component.html src/app/features/sprite-editor/sprite-editor.component.spec.ts
git commit -m "feature-93: wire the anchor tool into the sprite editor"
```

---

## Self-review checklist

- [ ] `DrawingTool` union includes `'anchor'`; toolbar button highlights like the others.
- [ ] Clicking with the Anchor tool emits a grid-snapped, in-bounds `TileAnchor` and never paints.
- [ ] A stored anchor is drawn as a subtle outline under the paint tools.
- [ ] `anchorChange` persists a `clampAnchor`-ed value via `TileService.updateTile`.
- [ ] **Auto** writes `{ anchor: null }` and disables when no manual anchor is set.
- [ ] Status bar shows `Anchor — X, Y` (or `Auto`) only while the tool is active.
- [ ] `devbox run npm run lint` and `devbox run npm run test` both clean.
