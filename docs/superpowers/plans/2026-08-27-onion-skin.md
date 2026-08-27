# Onion Skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add onion-skin reference layers (previous/next frame ghosting) to the sprite-editor's pixel canvas with opacity controls.

**Architecture:** Extend `pixel-canvas.component.ts` with two optional image layers rendered before/after the editable sprite. Parent `sprite-editor.component.ts` computes adjacent frame pixel data and exposes toggle + opacity UI signals. No DB changes.

**Tech Stack:** Angular 22, standalone components, signals, HTML5 Canvas 2D.

## Global Constraints

- Standalone components only; no `NgModule`.
- `ChangeDetectionStrategy.OnPush` required for shared components.
- Tailwind CSS with `tw-` prefix.
- Unit tests via Vitest + jsdom; `TestBed.configureTestingModule({ imports: […] })` for standalone setup.
- Async canvas operations flush with `await new Promise(r => setTimeout(r, 50))`.
- No raw hex/rgb/hsl — use Tailwind extended tokens or CSS custom properties.
- English UI copy only.

---

## Task 1: Pixel-canvas onion-skin inputs & rendering

**Files:**
- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.ts`
- Test: `src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts`

**Interfaces:**
- Consumes: nothing new (parent passes image URIs)
- Produces: `onionSkinPrev`, `onionSkinNext`, `onionSkinPrevOpacity`, `onionSkinNextOpacity` inputs; updated `render()` that draws prev/current/next in order.

- [ ] **Step 1: Write failing test — canvas draws previous onion skin**

```ts
it('should render previous onion skin when provided', async () => {
  const fixture = TestBed.configureTestingModule({
    imports: [PixelCanvasComponent],
  }).createComponent(PixelCanvasComponent);
  fixture.componentRef.setInput('paletteIndices', [[0, 0], [1, 1]]);
  fixture.componentRef.setInput('palette', ['#000000', '#ffffff']);
  fixture.componentRef.setInput('onionSkinPrev', 'data:image/png;base64,iVBORw0KGgoAAAA…');
  fixture.componentRef.setInput('onionSkinPrevOpacity', 0.5);
  fixture.detectChanges();
  await new Promise(r => setTimeout(r, 100));
  const canvas = fixture.nativeElement.querySelector('canvas');
  const ctxSpy = jest.spyOn(canvas.getContext('2d'), 'drawImage');
  fixture.detectChanges();
  await new Promise(r => setTimeout(r, 50));
  expect(ctxSpy).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test → FAIL** (inputs don't exist yet)

Run: `devbox run npx vitest run src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts`
Expected: FAIL — `onionSkinPrev` not a known input.

- [ ] **Step 3: Add inputs to pixel-canvas**

In `pixel-canvas.component.ts` add inside the class:

```ts
/** Pixel data URI of the previous frame for onion-skin reference, or null. */
onionSkinPrev = input<string | null>(null);
/** Pixel data URI of the next frame for onion-skin reference, or null. */
onionSkinNext = input<string | null>(null);
/** Opacity of the previous-frame onion skin (0–1). */
onionSkinPrevOpacity = input<number>(0.35);
/** Opacity of the next-frame onion skin (0–1). */
onionSkinNextOpacity = input<number>(0.35);
```

Add an effect that triggers re-render when these inputs change (reuse existing
`effect(() => { … this.render(); })` or extend it).

Add an internal signal cache for decoded onion-skin images, similar to
`loadedImages`:

```ts
private readonly onionSkinImages = signal<{ prev: HTMLImageElement | null; next: HTMLImageElement | null }>({ prev: null, next: null });
```

And an async loader method:

```ts
private async loadOnionSkinImages(): Promise<void> {
  const prevUri = this.onionSkinPrev();
  const nextUri = this.onionSkinNext();
  const [prevImg, nextImg] = await Promise.all([
    prevUri ? this.loadImage(prevUri) : Promise.resolve(null),
    nextUri ? this.loadImage(nextUri) : Promise.resolve(null),
  ]);
  this.onionSkinImages.set({ prev: prevImg, next: nextImg });
  this.render();
}
```

In the existing constructor effect that listens to input changes, also include
these new inputs and call `loadOnionSkinImages()`.

- [ ] **Step 4: Update `render()` to draw onion-skin layers**

Change the render method so the drawing order is:

```ts
// 1. Previous onion skin (behind current)
const prevImg = this.onionSkinImages().prev;
if (prevImg) {
  ctx.save();
  ctx.globalAlpha = this.onionSkinPrevOpacity();
  ctx.drawImage(prevImg, 0, 0, w * cell, h * cell);
  ctx.restore();
}

// 2. Current editable sprite (existing code)
// …existing draw logic…

// 3. Next onion skin (in front of current)
const nextImg = this.onionSkinImages().next;
if (nextImg) {
  ctx.save();
  ctx.globalAlpha = this.onionSkinNextOpacity();
  ctx.drawImage(nextImg, 0, 0, w * cell, h * cell);
  ctx.restore();
}
```

Place the next-skin draw **after** the current sprite but **before** the grid /
guides so the ghost does not obscure the cursor.

- [ ] **Step 5: Run pixel-canvas tests**

Run: `devbox run npx vitest run src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/sprite-editor/canvas/
git commit -m "feat: add onion-skin prev/next layers to pixel-canvas"
```

---

## Task 2: Sprite-editor onion-skin UI + state

**Files:**
- Modify: `src/app/features/sprite-editor/sprite-editor.component.ts`
- Modify: `src/app/features/sprite-editor/sprite-editor.component.html`
- Test: `src/app/features/sprite-editor/sprite-editor.component.spec.ts`

**Interfaces:**
- Consumes: pixel-canvas now accepts `onionSkinPrev`, `onionSkinNext`, opacities.
- Produces: `onionSkinPrevEnabled`, `onionSkinNextEnabled`, `onionSkinPrevOpacity`,
  `onionSkinNextOpacity` signals; computed `onionSkinPrevData` and `onionSkinNextData`.

- [ ] **Step 1: Write failing test — sprite-editor computes adjacent frame data**

Add to `sprite-editor.component.spec.ts`:

```ts
it('should compute previous onion skin data as the frame before current', async () => {
  component.currentFrames.set([{ id: 1, pixelData: 'A' }, { id: 2, pixelData: 'B' }] as Sprite[]);
  component.previewFrameIndex.set(1);
  fixture.detectChanges();
  await fixture.whenStable();
  expect(component.onionSkinPrevData()).toBe('A');
});
```

- [ ] **Step 2: Run test → FAIL** (properties don't exist)

Run: `devbox run npx vitest run src/app/features/sprite-editor/sprite-editor.component.spec.ts -t "onion skin"`
Expected: FAIL.

- [ ] **Step 3: Add signals and computed to sprite-editor**

In `sprite-editor.component.ts`:

```ts
readonly onionSkinPrevEnabled = signal(false);
readonly onionSkinNextEnabled = signal(false);
readonly onionSkinPrevOpacity = signal(0.35);
readonly onionSkinNextOpacity = signal(0.35);

readonly onionSkinPrevData = computed(() => {
  const frames = this.currentFrames();
  const idx = this.previewFrameIndex();
  return frames[idx - 1]?.pixelData ?? null;
});

readonly onionSkinNextData = computed(() => {
  const frames = this.currentFrames();
  const idx = this.previewFrameIndex();
  return frames[idx + 1]?.pixelData ?? null;
});
```

Add helper methods for the template:

```ts
hasPrevFrame(): boolean { return this.previewFrameIndex() > 0; }
hasNextFrame(): boolean {
  const frames = this.currentFrames();
  return this.previewFrameIndex() < frames.length - 1;
}
```

- [ ] **Step 4: Add toolbar UI in sprite-editor template**

In `sprite-editor.component.html`, above the `<rk-pixel-canvas>` binding, add a
compact toolbar row:

```html
@if (currentTile()?.type === 'animated' && currentFrames().length > 1) {
  <div class="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-1.5 tw-border-b tw-border-border tw-bg-card-bg">
    <span class="tw-text-[10px] tw-text-muted-foreground tw-uppercase tw-tracking-wider tw-font-semibold">Onion</span>
    <button
      type="button"
      (click)="onionSkinPrevEnabled.update(v => !v)"
      [disabled]="!hasPrevFrame()"
      [class.tw-text-accent]="onionSkinPrevEnabled()"
      [class.tw-text-muted-foreground]="!onionSkinPrevEnabled()"
      class="tw-p-1 tw-rounded-sm hover:tw-bg-muted tw-transition-colors disabled:tw-opacity-30"
      title="Previous frame"
    >
      <span class="material-symbols" aria-hidden="true">skip_previous</span>
    </button>
    @if (onionSkinPrevEnabled()) {
      <input type="range" min="0" max="100" [value]="onionSkinPrevOpacity() * 100"
             (input)="onionSkinPrevOpacity.set($any($event.target).valueAsNumber / 100)"
             class="tw-w-16 tw-h-1 tw-appearance-none tw-bg-muted tw-rounded-full" />
    }

    <button
      type="button"
      (click)="onionSkinNextEnabled.update(v => !v)"
      [disabled]="!hasNextFrame()"
      [class.tw-text-accent]="onionSkinNextEnabled()"
      [class.tw-text-muted-foreground]="!onionSkinNextEnabled()"
      class="tw-p-1 tw-rounded-sm hover:tw-bg-muted tw-transition-colors disabled:tw-opacity-30"
      title="Next frame"
    >
      <span class="material-symbols" aria-hidden="true">skip_next</span>
    </button>
    @if (onionSkinNextEnabled()) {
      <input type="range" min="0" max="100" [value]="onionSkinNextOpacity() * 100"
             (input)="onionSkinNextOpacity.set($any($event.target).valueAsNumber / 100)"
             class="tw-w-16 tw-h-1 tw-appearance-none tw-bg-muted tw-rounded-full" />
    }
  </div>
}
```

- [ ] **Step 5: Wire inputs to pixel-canvas**

Update the `<rk-pixel-canvas>` element in `sprite-editor.component.html`:

```html
<rk-pixel-canvas
  …existing inputs…
  [onionSkinPrev]="onionSkinPrevEnabled() ? onionSkinPrevData() : null"
  [onionSkinNext]="onionSkinNextEnabled() ? onionSkinNextData() : null"
  [onionSkinPrevOpacity]="onionSkinPrevOpacity()"
  [onionSkinNextOpacity]="onionSkinNextOpacity()"
/>
```

- [ ] **Step 6: Run sprite-editor tests**

Run: `devbox run npx vitest run src/app/features/sprite-editor/sprite-editor.component.spec.ts`
Expected: PASS (existing tests still pass; new onion-skin tests pass).

- [ ] **Step 7: Commit**

```bash
git add src/app/features/sprite-editor/
git commit -m "feat: onion-skin toolbar and state in sprite-editor"
```

---

## Task 3: Lint + build + full test verification

- [ ] **Step 1: Run lint**

Run: `devbox run npm run lint`
Expected: All files pass linting.

- [ ] **Step 2: Run build**

Run: `devbox run npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Run full test suite**

Run: `devbox run npm run test`
Expected: All pre-existing failures remain pre-existing; no new failures introduced.

- [ ] **Step 4: Commit (if lint fix needed)**

If only lint fix applied:

```bash
git add …
git commit -m "chore: lint fixes for onion skin"
```