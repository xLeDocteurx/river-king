# Sprite Canvas Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mouse-wheel zoom to the pixel canvas so the sprite can fill the available container space without cropping, with zoom centered on the cursor.

**Architecture:** CSS `transform: scale(zoom)` on the `<canvas>` element, with `image-rendering: pixelated` for crisp pixels. A `ResizeObserver` on the container provides max zoom bounds. Coordinate conversion divides by `(cellScale * zoom)`.

**Tech Stack:** Angular signals, CSS transforms, ResizeObserver API, Vitest + jsdom.

## Global Constraints

- Angular 22 standalone components, no NgModule
- Tailwind prefix `tw-` (e.g. `tw-bg-background`)
- ChangeDetectionStrategy.OnPush
- Signals preferred over RxJS for component state
- Material Symbols for icons
- Never inline templates — use `templateUrl` and `styleUrl`
- Tests via Vitest (`npm run test`)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/features/sprite-editor/canvas/pixel-canvas.component.ts` | Modify | Add zoom signal, ResizeObserver, maxZoom, wheel handler, cursor-centered transform-origin, update coordinate conversion |
| `src/app/features/sprite-editor/canvas/pixel-canvas.component.html` | Modify | Add `(wheel)` event binding |
| `src/app/features/sprite-editor/canvas/pixel-canvas.component.scss` | Modify | Add `image-rendering: pixelated` |
| `src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts` | Modify | Add zoom tests, update existing tests if needed |
| `src/app/features/sprite-editor/sprite-editor.component.html` | Modify | Add `overflow: hidden` + `flex: 1` on container div |

---

## Task 1: Container layout — make center column fill space and clip overflow

**Files:**
- Modify: `src/app/features/sprite-editor/sprite-editor.component.html:48-49`

**Interfaces:**
- Consumes: none
- Produces: container div that fills available height, clips overflow, centers canvas

- [ ] **Step 1: Update the center column div**

Change line 49 from:
```html
    class="tw-flex-1 tw-flex tw-flex-col tw-items-center tw-justify-center tw-bg-background tw-p-4 tw-gap-4"
```
to:
```html
    class="tw-flex-1 tw-flex tw-flex-col tw-items-center tw-justify-center tw-bg-background tw-p-4 tw-gap-4 tw-overflow-hidden"
```

- [ ] **Step 2: Run existing tests to verify no regression**

Run: `npm run test`
Expected: All 6 pixel-canvas tests pass, all other tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/sprite-editor/sprite-editor.component.html
git commit -m "sprite-canvas-zoom: add overflow hidden to canvas container"
```

---

## Task 2: Add image-rendering: pixelated to canvas

**Files:**
- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.scss`

**Interfaces:**
- Consumes: none
- Produces: canvas element renders crisp pixels when scaled via CSS transform

- [ ] **Step 1: Add CSS rule**

Replace the entire content of `pixel-canvas.component.scss` with:
```scss
canvas {
  image-rendering: pixelated;
}
```

- [ ] **Step 2: Run existing tests**

Run: `npm run test`
Expected: All tests pass (SCSS change has no behavioral effect).

- [ ] **Step 3: Commit**

```bash
git add src/app/features/sprite-editor/canvas/pixel-canvas.component.scss
git commit -m "sprite-canvas-zoom: add pixelated rendering to canvas"
```

---

## Task 3: Add zoom signal, ResizeObserver, and maxZoom computed

**Files:**
- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.ts:1-78`

**Interfaces:**
- Consumes: `canvasWidth`, `canvasHeight` computed signals (existing)
- Produces: `zoom` signal (number, default 1), `containerWidth` signal, `containerHeight` signal, `maxZoom` computed signal

- [ ] **Step 1: Add import for `AfterViewInit` and `ElementRef`**

These are already imported. Add `DestroyRef` to the import list on line 1-12:
```typescript
import {
  Component,
  computed,
  input,
  output,
  signal,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
  AfterViewInit,
  DestroyRef,
  effect,
} from '@angular/core';
```

- [ ] **Step 2: Add container ref, zoom signals, and ResizeObserver setup**

After the `canvasRef` declaration (line 31), add:
```typescript
  /** Reference to the container div wrapping the canvas. */
  containerRef = viewChild<ElementRef<HTMLDivElement>>('container');
```

After the `canvasHeight` computed (line 63), add:
```typescript
  /** Current zoom level (1 = 1:1). */
  readonly zoom = signal(1);

  /** Container width in CSS pixels, updated by ResizeObserver. */
  readonly containerWidth = signal(0);

  /** Container height in CSS pixels, updated by ResizeObserver. */
  readonly containerHeight = signal(0);

  /** Maximum zoom so the sprite fills the container without cropping. */
  readonly maxZoom = computed(() => {
    const cw = this.containerWidth();
    const ch = this.containerHeight();
    const canvasW = this.canvasWidth();
    const canvasH = this.canvasHeight();
    if (canvasW === 0 || canvasH === 0 || cw === 0 || ch === 0) return 1;
    return Math.max(1, Math.min(cw / canvasW, ch / canvasH));
  });
```

- [ ] **Step 3: Add DestroyRef injection and ResizeObserver in constructor**

Replace the constructor (lines 69-78) with:
```typescript
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      const container = this.containerRef()?.nativeElement;
      if (!container) return;

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          this.containerWidth.set(entry.contentRect.width);
          this.containerHeight.set(entry.contentRect.height);
        }
      });
      observer.observe(container);

      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    effect(() => {
      const indices = this.paletteIndices();
      this.localPaletteIndices = indices.map((row) => [...row]);
      this.gridRows.set(Math.max(1, indices.length));
      this.gridCols.set(Math.max(1, ...indices.map((row) => row.length)));
      this.zoom.set(1);
      this.syncCanvasSize();
      this.render();
    });
  }
```

Add `inject` to the imports if not already present (it is not currently imported):
```typescript
import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
  AfterViewInit,
  DestroyRef,
  effect,
} from '@angular/core';
```

- [ ] **Step 4: Run existing tests**

Run: `npm run test`
Expected: All tests pass. Zoom defaults to 1, ResizeObserver is a no-op in jsdom (containerWidth/Height stay 0, maxZoom stays 1).

---

## Task 4: Add wheel handler and cursor-centered transform-origin

**Files:**
- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.ts` (add `onWheel` method)
- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.html` (add `(wheel)` binding)

**Interfaces:**
- Consumes: `zoom` signal, `maxZoom` computed, `canvasRef`, `rectCache`
- Produces: `onWheel(event: WheelEvent)` method that updates `zoom` and sets transform-origin

- [ ] **Step 1: Add the onWheel method to the component**

Add after the `onMouseLeave` method (after line 191):
```typescript
  /**
   * Handles mouse wheel to zoom in/out, centered on the cursor position.
   * @param event - The wheel event.
   */
  onWheel(event: WheelEvent) {
    event.preventDefault();
    const ref = this.canvasRef();
    if (!ref) return;

    const rect = ref.nativeElement.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;

    const oldZoom = this.zoom();
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = Math.min(this.maxZoom(), Math.max(1, oldZoom * factor));

    if (newZoom === oldZoom) return;

    // Adjust transform-origin so the point under the cursor stays fixed
    const originX = cursorX * (newZoom / oldZoom);
    const originY = cursorY * (newZoom / oldZoom);

    ref.nativeElement.style.transformOrigin = `${originX}px ${originY}px`;
    ref.nativeElement.style.transform = `scale(${newZoom})`;

    this.zoom.set(newZoom);
  }
```

- [ ] **Step 2: Add (wheel) binding to the template**

Update `pixel-canvas.component.html` to:
```html
<canvas
  #canvas
  class="tw-cursor-crosshair"
  (mousedown)="onMouseDown($event)"
  (mousemove)="onMouseMove($event)"
  (mouseup)="onMouseUp()"
  (mouseleave)="onMouseLeave()"
  (wheel)="onWheel($event)"
></canvas>
```

- [ ] **Step 3: Run existing tests**

Run: `npm run test`
Expected: All tests pass. The wheel handler is not triggered by existing tests.

---

## Task 5: Update coordinate conversion to account for zoom

**Files:**
- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.ts:150-158` (`getPixelCoordinates`)

**Interfaces:**
- Consumes: `zoom` signal, `cellScale` computed
- Produces: corrected grid coordinates at any zoom level

- [ ] **Step 1: Update getPixelCoordinates to divide by (cellScale * zoom)**

Replace the `getPixelCoordinates` method (lines 150-158) with:
```typescript
  /**
   * Converts a mouse event into pixel grid coordinates, accounting for CSS zoom.
   * @param event - The mouse event to convert.
   * @returns Grid coordinates { x, y } clamped to the sprite bounds.
   */
  private getPixelCoordinates(event: MouseEvent): { x: number; y: number } {
    if (!this.rectCache) {
      return { x: -1, y: -1 };
    }
    const scale = this.cellScale() * this.zoom();
    const x = Math.floor((event.clientX - this.rectCache.left) / scale);
    const y = Math.floor((event.clientY - this.rectCache.top) / scale);
    return { x, y };
  }
```

- [ ] **Step 2: Run existing tests**

Run: `npm run test`
Expected: All tests pass. Existing tests use zoom=1 (default), so `cellScale * 1 === cellScale` — no behavioral change.

---

## Task 6: Update JSDoc for the component class

**Files:**
- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.ts:14-21` (class-level JSDoc)

**Interfaces:**
- Consumes: none
- Produces: accurate class documentation

- [ ] **Step 1: Update the class-level JSDoc**

Replace lines 14-21 with:
```typescript
/**
 * Pixel canvas component for drawing and editing sprite pixel data.
 *
 * Renders a grid matching the sprite dimensions derived from the
 * `paletteIndices` input (any width/height), with an adaptive cell scale that
 * keeps the canvas around 256px. Supports brush, eraser, and flood-fill
 * tools. Emits updated palette indices on change.
 *
 * Supports mouse-wheel zoom centered on the cursor. The canvas is visually
 * scaled via CSS `transform: scale()` while its logical size stays fixed.
 * Zoom resets when the sprite changes.
 */
```

- [ ] **Step 2: Run tests**

Run: `npm run test`
Expected: All tests pass.

---

## Task 7: Add zoom tests

**Files:**
- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts`

**Interfaces:**
- Consumes: `zoom` signal, `maxZoom` computed, `onWheel` method, `getPixelCoordinates` (private, tested via mouse events)
- Produces: tests verifying zoom behavior

- [ ] **Step 1: Add test for zoom default and maxZoom**

Add after the existing "should create" test (after line 61):
```typescript
  it('should default zoom to 1', () => {
    setupInputs(Array.from({ length: 16 }, () => Array(16).fill(0)));
    expect(fixture.componentInstance.zoom()).toBe(1);
  });

  it('should compute maxZoom from container and canvas dimensions', () => {
    setupInputs(Array.from({ length: 16 }, () => Array(16).fill(0)));
    // containerWidth/Height default to 0 in jsdom → maxZoom = 1
    expect(fixture.componentInstance.maxZoom()).toBe(1);
  });
```

- [ ] **Step 2: Add test for wheel event changing zoom**

Add after the maxZoom test:
```typescript
  it('should zoom in on wheel up and zoom out on wheel down', () => {
    setupInputs(Array.from({ length: 16 }, () => Array(16).fill(0)));
    const canvas = fixture.nativeElement.querySelector('canvas');
    const rect = { left: 0, top: 0, width: 256, height: 256 };
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);

    // Wheel up (deltaY < 0) → zoom in
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 128, clientY: 128, bubbles: true }));
    expect(fixture.componentInstance.zoom()).toBeGreaterThan(1);

    const zoomAfterIn = fixture.componentInstance.zoom();

    // Wheel down (deltaY > 0) → zoom out
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, clientX: 128, clientY: 128, bubbles: true }));
    expect(fixture.componentInstance.zoom()).toBeLessThan(zoomAfterIn);
  });
```

- [ ] **Step 3: Add test for zoom reset on sprite change**

Add after the wheel zoom test:
```typescript
  it('should reset zoom to 1 when sprite changes', () => {
    setupInputs(Array.from({ length: 16 }, () => Array(16).fill(0)));
    const canvas = fixture.nativeElement.querySelector('canvas');
    const rect = { left: 0, top: 0, width: 256, height: 256 };
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);

    // Zoom in
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 128, clientY: 128, bubbles: true }));
    expect(fixture.componentInstance.zoom()).toBeGreaterThan(1);

    // Change sprite → zoom resets
    const newIndices = Array.from({ length: 32 }, () => Array(32).fill(0));
    setupInputs(newIndices);
    expect(fixture.componentInstance.zoom()).toBe(1);
  });
```

- [ ] **Step 4: Add test for coordinate conversion at non-1x zoom**

Add after the zoom reset test:
```typescript
  it('should correctly convert coordinates at non-1x zoom', () => {
    setupInputs(Array.from({ length: 16 }, () => Array(16).fill(0)));
    const spy = vi.fn();
    fixture.componentInstance.indicesChange.subscribe(spy);

    const canvas = fixture.nativeElement.querySelector('canvas');
    const rect = { left: 0, top: 0, width: 256, height: 256 };
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);

    // Zoom in to 2x via direct signal set
    fixture.componentInstance.zoom.set(2);
    canvas.style.transformOrigin = '0px 0px';
    canvas.style.transform = 'scale(2)';

    // At 2x zoom, cellScale=16, effective scale=32. clientX=64 → grid x = 64/32 = 2
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 64, clientY: 64, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(spy).toHaveBeenCalled();
    const emitted = spy.mock.calls[0][0] as number[][];
    expect(emitted[2][2]).toBe(1);
  });
```

- [ ] **Step 5: Run all tests**

Run: `npm run test`
Expected: All tests pass including the 4 new zoom tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/sprite-editor/canvas/pixel-canvas.component.ts \
        src/app/features/sprite-editor/canvas/pixel-canvas.component.html \
        src/app/features/sprite-editor/canvas/pixel-canvas.component.scss \
        src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts
git commit -m "sprite-canvas-zoom: implement cursor-centered zoom with tests"
```

---

## Task 8: Run lint and format check

**Files:**
- None (verification only)

- [ ] **Step 1: Run format**

Run: `npm run format`
Expected: Prettier formats all files (may fix whitespace).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Run full test suite one final time**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 4: Commit any formatting changes**

```bash
git add -A
git commit -m "sprite-canvas-zoom: format and lint fixes" --allow-empty
```
(Skip commit if no changes.)
