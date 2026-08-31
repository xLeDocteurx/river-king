# Sprite Editor Onion Controls Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the always-visible inline Onion row in the sprite editor with a single floating button + non-modal popover holding the same onion controls.

**Architecture:** Add a small UI-state signal (`onionPanelOpen`) plus outside-click/Escape host listeners and close-on-select logic to `SpriteEditorComponent`; move the existing prev/next toggles + opacity sliders from the inline row into a popover panel anchored to a floating button over the pixel canvas.

**Tech Stack:** Angular 22 standalone components, signals, Tailwind CSS (`tw-` prefix), Material Symbols, Vitest + jsdom.

## Global Constraints

- Commit prefix: `feature-41: `.
- Tailwind classes must use the `tw-` prefix (e.g. `tw-absolute`, `tw-relative`).
- `tw-` token-bound colors only — never hardcode hex/rgb. Use `tw-bg-card-bg`, `tw-bg-background`, `tw-border-border`, `tw-text-foreground`, `hover:tw-bg-accent`.
- Material Symbols for icons (`<span class="material-symbols" aria-hidden="true">…</span>`).
- Every public method needs a JSDoc block with `@param` where applicable.
- Every component class has a class-level JSDoc (already present on `SpriteEditorComponent`).
- UI copy in English only.
- No inline templates; keep `templateUrl` / `styleUrl`.
- Onion-skin rendering inputs passed to `<rk-pixel-canvas>` are unchanged.
- Existing inline row removed; onion value signals (`onionSkinPrevEnabled/NextEnabled`, `onionSkinPrevOpacity/NextOpacity`) stay and are reused as-is.

---

### Task 1: Onion panel open state + close behaviors (signals and handlers)

**Files:**
- Modify: `src/app/features/sprite-editor/sprite-editor.component.ts`
- Test: `src/app/features/sprite-editor/sprite-editor.component.spec.ts`

**Interfaces:**
- Consumes: existing `@HostListener`-compatible host element (component already root-rendered by the test harness); no `ViewChild` yet (added in Task 2).
- Produces: `onionPanelOpen: Signal<boolean>`, `toggleOnionPanel(): void`, `closeOnionPanel(): void`. `selectSprite` and `selectTile` close the panel on switch. The `@HostListener('document:click')` handler is added in Task 2 (needs the wrapper element ref).

- [ ] **Step 1: Write the failing tests**

Append these tests to `sprite-editor.component.spec.ts`. They set up an animated 2-frame tile directly on the component (mirroring the existing pattern at lines 432-446).

```ts
it('closes the onion panel when switching to another sprite', async () => {
  fixture = TestBed.createComponent(SpriteEditorComponent);
  const component = fixture.componentInstance;
  component.sprites.set([
    { id: 1, pixelData: 'A', tileId: 10 } as Sprite,
    { id: 2, pixelData: 'B', tileId: 10 } as Sprite,
  ]);
  component.tiles.set([
    { id: 10, name: 'Test', spriteIds: [1, 2], type: 'animated' } as Tile,
  ]);
  component.selectedTileId.set(10);
  component.selectedSpriteId.set(1);
  component.onionPanelOpen.set(true);
  component.selectSprite(2);
  fixture.detectChanges();
  expect(component.onionPanelOpen()).toBe(false);
});

it('closes the onion panel when switching to another tile', async () => {
  fixture = TestBed.createComponent(SpriteEditorComponent);
  const component = fixture.componentInstance;
  component.sprites.set([
    { id: 1, pixelData: 'A', tileId: 10 } as Sprite,
    { id: 2, pixelData: 'B', tileId: 20 } as Sprite,
  ]);
  component.tiles.set([
    { id: 10, name: 'T1', spriteIds: [1], type: 'animated' } as Tile,
    { id: 20, name: 'T2', spriteIds: [2], type: 'animated' } as Tile,
  ]);
  component.selectedTileId.set(10);
  component.selectedSpriteId.set(1);
  component.onionPanelOpen.set(true);
  await component.selectTile(20);
  fixture.detectChanges();
  expect(component.onionPanelOpen()).toBe(false);
});

it('toggleOnionPanel flips the onion panel open state', () => {
  fixture = TestBed.createComponent(SpriteEditorComponent);
  const component = fixture.componentInstance;
  expect(component.onionPanelOpen()).toBe(false);
  component.toggleOnionPanel();
  expect(component.onionPanelOpen()).toBe(true);
  component.toggleOnionPanel();
  expect(component.onionPanelOpen()).toBe(false);
});

it('closeOnionPanel sets the onion panel closed', () => {
  fixture = TestBed.createComponent(SpriteEditorComponent);
  const component = fixture.componentInstance;
  component.onionPanelOpen.set(true);
  component.closeOnionPanel();
  expect(component.onionPanelOpen()).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npm run test -- --include src/app/features/sprite-editor/sprite-editor.component.spec.ts`
Expected: FAIL — `onionPanelOpen` / `toggleOnionPanel` / `closeOnionPanel` do not exist.

- [ ] **Step 3: Write minimal implementation**

In `sprite-editor.component.ts`:

Add to the imports at the top:

```ts
import { HostListener, ... } from '@angular/core';
```

(Add `HostListener` to the existing `@angular/core` import list.)

Add near the other onion signals (after `onionSkinNextOpacity`, ~line 149):

```ts
/** Whether the onion-skin controls popover is currently open. */
readonly onionPanelOpen = signal(false);
```

Add public methods (place near `hasPrevFrame`/`hasNextFrame`):

```ts
/** Opens or closes the onion-skin controls popover. */
toggleOnionPanel(): void {
  this.onionPanelOpen.update((v) => !v);
}

/** Closes the onion-skin controls popover. */
closeOnionPanel(): void {
  this.onionPanelOpen.set(false);
}
```

Close on tile/frame switch. Locate `selectTile` (sets `selectedTileId`) and `selectSprite` (sets `selectedSpriteId`), and add a close call at the top of each:

```ts
selectTile(...): ... {
  this.onionPanelOpen.set(false);
  ...
}

selectSprite(...): ... {
  this.onionPanelOpen.set(false);
  ...
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devbox run npm run test -- --include src/app/features/sprite-editor/sprite-editor.component.spec.ts`
Expected: PASS (all four new tests plus the existing sprite-editor tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/sprite-editor/sprite-editor.component.ts src/app/features/sprite-editor/sprite-editor.component.spec.ts
git commit -m "feature-41: add onion popover open state and close-on-select behavior"
```

---

### Task 2: Floating button + popover panel in the template

**Files:**
- Modify: `src/app/features/sprite-editor/sprite-editor.component.ts`
- Modify: `src/app/features/sprite-editor/sprite-editor.component.html`
- Test: `src/app/features/sprite-editor/sprite-editor.component.spec.ts`

**Interfaces:**
- Consumes: `onionPanelOpen`, `toggleOnionPanel`, `closeOnionPanel`, `onionSkinPrevEnabled/NextEnabled`, `onionSkinPrevOpacity/NextOpacity`, `hasPrevFrame()`, `hasNextFrame()`, `currentTile()`, `currentFrames()` from Task 1 / existing code.
- Produces: a `@ViewChild('onionAnchor')` element ref used by the outside-click host listener so the panel closes only when clicking outside the button+panel.

- [ ] **Step 1: Write the failing tests**

Append to `sprite-editor.component.spec.ts`:

```ts
it('renders the onion floating button for an animated multi-frame tile and no inline Onion row', () => {
  fixture = TestBed.createComponent(SpriteEditorComponent);
  const component = fixture.componentInstance;
  component.sprites.set([
    { id: 1, pixelData: 'A', tileId: 10 } as Sprite,
    { id: 2, pixelData: 'B', tileId: 10 } as Sprite,
  ]);
  component.tiles.set([
    { id: 10, name: 'Test', spriteIds: [1, 2], type: 'animated' } as Tile,
  ]);
  component.selectedTileId.set(10);
  component.selectedSpriteId.set(1);
  component.selectedSprite.set(component.sprites()[0]);
  fixture.detectChanges();
  const compiled = fixture.nativeElement as HTMLElement;
  const onionButton = compiled.querySelector('button[aria-label="Onion skin controls"]');
  expect(onionButton).toBeTruthy();
  expect(compiled.textContent).not.toContain('Onion');
});

it('does not render the onion button for a static or single-frame tile', () => {
  fixture = TestBed.createComponent(SpriteEditorComponent);
  const component = fixture.componentInstance;
  component.sprites.set([{ id: 1, pixelData: 'A', tileId: 10 } as Sprite]);
  component.tiles.set([
    { id: 10, name: 'Static', spriteIds: [1], type: 'static' } as Tile,
  ]);
  component.selectedTileId.set(10);
  component.selectedSpriteId.set(1);
  component.selectedSprite.set(component.sprites()[0]);
  fixture.detectChanges();
  const compiled = fixture.nativeElement as HTMLElement;
  expect(compiled.querySelector('button[aria-label="Onion skin controls"]')).toBeNull();
});

it('opens the popover on button click and closes on re-click', () => {
  fixture = TestBed.createComponent(SpriteEditorComponent);
  const component = fixture.componentInstance;
  component.sprites.set([
    { id: 1, pixelData: 'A', tileId: 10 } as Sprite,
    { id: 2, pixelData: 'B', tileId: 10 } as Sprite,
  ]);
  component.tiles.set([
    { id: 10, name: 'Test', spriteIds: [1, 2], type: 'animated' } as Tile,
  ]);
  component.selectedTileId.set(10);
  component.selectedSpriteId.set(1);
  component.selectedSprite.set(component.sprites()[0]);
  fixture.detectChanges();
  const compiled = fixture.nativeElement as HTMLElement;
  const onionButton = compiled.querySelector(
    'button[aria-label="Onion skin controls"]',
  ) as HTMLButtonElement;
  onionButton.click();
  fixture.detectChanges();
  expect(component.onionPanelOpen()).toBe(true);
  expect(compiled.textContent).toContain('skip_previous');

  onionButton.click();
  fixture.detectChanges();
  expect(component.onionPanelOpen()).toBe(false);
});

it('closes the popover when clicking outside the anchor', () => {
  fixture = TestBed.createComponent(SpriteEditorComponent);
  const component = fixture.componentInstance;
  component.sprites.set([
    { id: 1, pixelData: 'A', tileId: 10 } as Sprite,
    { id: 2, pixelData: 'B', tileId: 10 } as Sprite,
  ]);
  component.tiles.set([
    { id: 10, name: 'Test', spriteIds: [1, 2], type: 'animated' } as Tile,
  ]);
  component.selectedTileId.set(10);
  component.selectedSpriteId.set(1);
  component.selectedSprite.set(component.sprites()[0]);
  fixture.detectChanges();
  component.onionPanelOpen.set(true);
  fixture.detectChanges();
  document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(component.onionPanelOpen()).toBe(false);
});

it('closes the popover when pressing Escape', () => {
  fixture = TestBed.createComponent(SpriteEditorComponent);
  const component = fixture.componentInstance;
  component.onionPanelOpen.set(true);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
  expect(component.onionPanelOpen()).toBe(false);
});

it('prev/next toggles and opacity sliders in the popover keep working', () => {
  fixture = TestBed.createComponent(SpriteEditorComponent);
  const component = fixture.componentInstance;
  component.sprites.set([
    { id: 1, pixelData: 'A', tileId: 10 } as Sprite,
    { id: 2, pixelData: 'B', tileId: 10 } as Sprite,
  ]);
  component.tiles.set([
    { id: 10, name: 'Test', spriteIds: [1, 2], type: 'animated' } as Tile,
  ]);
  component.selectedTileId.set(10);
  component.selectedSpriteId.set(2);
  component.selectedSprite.set(component.sprites()[1]);
  component.onionPanelOpen.set(true);
  fixture.detectChanges();
  const compiled = fixture.nativeElement as HTMLElement;
  const prevToggle = compiled.querySelector(
    'button[title="Previous frame"]',
  ) as HTMLButtonElement;
  prevToggle.click();
  fixture.detectChanges();
  expect(component.onionSkinPrevEnabled()).toBe(true);
  const nextToggle = compiled.querySelector('button[title="Next frame"]') as HTMLButtonElement;
  nextToggle.click();
  fixture.detectChanges();
  expect(component.onionSkinNextEnabled()).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npm run test -- --include src/app/features/sprite-editor/sprite-editor.component.spec.ts`
Expected: FAIL — no `button[aria-label="Onion skin controls"]` exists yet.

- [ ] **Step 3: Implement the template + host listener**

**sprite-editor.component.html** — replace the inline Onion row currently at lines 40-92 (the whole `@if (currentTile()?.type === 'animated' && currentFrames().length > 1) { <div class="tw-flex tw-items-center ...">…</div> }` block) with a relative wrapper around `<rk-pixel-canvas>` that hosts the floating button + popover:

```html
<div class="tw-relative" #onionAnchor>
  <rk-pixel-canvas
    [paletteIndices]="indices"
    [palette]="projectPalette()"
    [selectedColorIndex]="selectedColorIndex()"
    [tool]="selectedTool()"
    [onionSkinPrev]="onionSkinPrevEnabled() ? onionSkinPrevData() : null"
    [onionSkinNext]="onionSkinNextEnabled() ? onionSkinNextData() : null"
    [onionSkinPrevOpacity]="onionSkinPrevOpacity()"
    [onionSkinNextOpacity]="onionSkinNextOpacity()"
    (indicesChange)="onCanvasChange($event)"
    (strokeStart)="onStrokeStart()"
    (strokeEnd)="onStrokeEnd($event)"
    (zoomChange)="zoomLevel.set($event)"
  />
  @if (currentTile()?.type === 'animated' && currentFrames().length > 1) {
    <button
      type="button"
      (click)="toggleOnionPanel()"
      [attr.aria-label]="'Onion skin controls'"
      [attr.aria-expanded]="onionPanelOpen()"
      [title]="onionPanelOpen() ? 'Close onion skin controls' : 'Onion skin controls'"
      class="tw-absolute tw-bottom-1 tw-left-1 tw-z-10 tw-flex tw-items-center tw-justify-center tw-w-6 tw-h-6 tw-rounded-sm tw-bg-card-bg tw-border tw-border-border tw-text-foreground tw-cursor-pointer hover:tw-bg-accent"
    >
      <span class="material-symbols tw-text-sm" aria-hidden="true">invert_colors</span>
    </button>
    @if (onionPanelOpen()) {
      <div
        class="tw-absolute tw-bottom-9 tw-left-0 tw-z-10 tw-flex tw-flex-col tw-gap-1 tw-rounded-sm tw-border tw-border-border tw-bg-background tw-px-3 tw-py-2 tw-shadow-md"
      >
        <div class="tw-flex tw-items-center tw-gap-2">
          <span class="tw-text-[10px] tw-text-muted-foreground tw-uppercase tw-tracking-wider tw-font-semibold">Prev</span>
          <button
            type="button"
            (click)="onionSkinPrevEnabled.update((v) => !v)"
            [disabled]="!hasPrevFrame()"
            [class.tw-text-accent]="onionSkinPrevEnabled()"
            [class.tw-text-muted-foreground]="!onionSkinPrevEnabled()"
            class="tw-p-1 tw-rounded-sm hover:tw-bg-muted tw-transition-colors disabled:tw-opacity-30"
            title="Previous frame"
          >
            <span class="material-symbols" aria-hidden="true">skip_previous</span>
          </button>
          @if (onionSkinPrevEnabled()) {
            <input
              type="range"
              min="0"
              max="100"
              [value]="onionSkinPrevOpacity() * 100"
              (input)="onionSkinPrevOpacity.set($any($event.target).valueAsNumber / 100)"
              class="tw-w-16 tw-h-1 tw-appearance-none tw-bg-muted tw-rounded-full"
              title="Previous frame opacity"
            />
          }
        </div>
        <div class="tw-flex tw-items-center tw-gap-2">
          <span class="tw-text-[10px] tw-text-muted-foreground tw-uppercase tw-tracking-wider tw-font-semibold">Next</span>
          <button
            type="button"
            (click)="onionSkinNextEnabled.update((v) => !v)"
            [disabled]="!hasNextFrame()"
            [class.tw-text-accent]="onionSkinNextEnabled()"
            [class.tw-text-muted-foreground]="!onionSkinNextEnabled()"
            class="tw-p-1 tw-rounded-sm hover:tw-bg-muted tw-transition-colors disabled:tw-opacity-30"
            title="Next frame"
          >
            <span class="material-symbols" aria-hidden="true">skip_next</span>
          </button>
          @if (onionSkinNextEnabled()) {
            <input
              type="range"
              min="0"
              max="100"
              [value]="onionSkinNextOpacity() * 100"
              (input)="onionSkinNextOpacity.set($any($event.target).valueAsNumber / 100)"
              class="tw-w-16 tw-h-1 tw-appearance-none tw-bg-muted tw-rounded-full"
              title="Next frame opacity"
            />
          }
        </div>
      </div>
    }
  }
</div>
```

**sprite-editor.component.ts** — add the view child + host listeners:

Add `ViewChild` to the `@angular/core` import list:

```ts
import { HostListener, ViewChild, ... } from '@angular/core';
```

Add a referenced element near the top of the class body:

```ts
/** Reference to the wrapper anchoring the onion popover (button + panel). */
@ViewChild('onionAnchor', { static: false }) onionAnchor?: ElementRef<HTMLElement>;
```

(`ElementRef` import is NOT needed if declared inline; but to reference the type, add `ElementRef` to imports.) Add `ElementRef` to the `@angular/core` import list.

Add host listeners (place near the methods):

```ts
/**
 * Closes the onion popover when a click lands outside the button + panel.
 * @param event - The document-level mouse click event.
 */
@HostListener('document:click', ['$event'])
onDocumentClick(event: MouseEvent): void {
  if (!this.onionPanelOpen()) return;
  const anchor = this.onionAnchor?.nativeElement;
  if (!anchor?.contains(event.target as Node)) {
    this.closeOnionPanel();
  }
}

/**
 * Closes the onion popover when the user presses Escape.
 */
@HostListener('document:keydown.escape')
onEscape(): void {
  this.closeOnionPanel();
}
```

Note: the floating button sits inside `onionAnchor`, so a click on it is contained and does not immediately close the panel via `onDocumentClick`; the button's own `(click)="toggleOnionPanel()"` toggles it. The `@HostListener('document:click')` subscribes via the component's own element listeners, which Angular wires up in a way that also runs for the button's own click — but because the click target is contained, the guard keeps it open.

- [ ] **Step 4: Run test to verify it passes**

Run: `devbox run npm run test -- --include src/app/features/sprite-editor/sprite-editor.component.spec.ts`
Expected: PASS. Then run the full suite to catch regressions:
Run: `devbox run npm run test`
Expected: all tests pass.

- [ ] **Step 5: Run lint**

Run: `devbox run npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/sprite-editor/sprite-editor.component.ts src/app/features/sprite-editor/sprite-editor.component.html src/app/features/sprite-editor/sprite-editor.component.spec.ts
git commit -m "feature-41: replace inline onion row with floating button and popover"
```

---

## Self-Review (performed at plan writing)

- **Spec coverage:** floating button (Task 2), popover holds prev/next + sliders (Task 2), closes on outside click (Task 2 `onDocumentClick`), Escape (Task 2 `onEscape`), re-click (button `toggleOnionPanel`), tile/frame switch (Task 1 selectTile/selectSprite), rendering unchanged (inputs untouched), styling follows design system (tokens + `tw-`). All covered.
- **Placeholder scan:** complete code provided in every code step; no TBD/TODO.
- **Type consistency:** `onionPanelOpen`, `toggleOnionPanel`, `closeOnionPanel`, `onionAnchor` used consistently across both tasks and tests.
- **Risk note:** the doc `@HostListener('document:click')` plus the floating button's own `(click)` coexist safely because the guard checks containment; documented in Task 2 Step 3.
