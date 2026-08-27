# Frame Strip Drag & Drop with CDK

Date: 2026-08-27
Status: Approved

## Problem

Reordering frames in the sprite editor (`frame-strip.component`) works but gives
almost no visual feedback about where the dragged frame will land. The current
implementation uses native HTML5 drag & drop: `onDragStart` records the source
index, `onDrop` emits `[fromIndex, toIndex]`, and the only visual is the
browser's default drag ghost. The user cannot see the drop position in advance.

## Solution

Migrate the frame strip from native drag & drop to Angular CDK drag & drop
(`CdkDropList`, `CdkDrag`, `CdkDragPreview`, `CdkDragPlaceholder`). CDK is already
a dependency (`@angular/cdk@^22.1.3` in `package.json:17`) and is already used by
`scene-list.component.ts` for folder reordering, so this follows an existing
in-repo pattern.

Key UX win: the `*cdkDragPlaceholder` slot moves along the strip as the pointer
passes over neighboring frames, and neighboring frames animate aside, so the
user clearly sees exactly where the frame will land before releasing the mouse.

## Changes

### `frame-strip.component.ts`

- Remove `dragIndex` field and `onDragStart`, `onDragOver`, `onDragEnd` methods.
- Replace `onDrop(index: number)` with `onDropped(event: CdkDragDrop<Sprite[]>)`
  that emits `frameReorder` when `previousIndex !== currentIndex`:
  ```ts
  onDropped(event: CdkDragDrop<Sprite[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      this.frameReorder.emit([event.previousIndex, event.currentIndex]);
    }
  }
  ```
- Add imports: `CdkDropList`, `CdkDrag`, `CdkDragPreview`, `CdkDragPlaceholder`,
  and `CdkDragDrop` from `@angular/cdk/drag-drop`.
- Update imports array in `@Component()`.

### `frame-strip.component.html`

- Make the scrollable frame container a drop list:
  ```html
  <div
    class="tw-flex tw-items-center tw-gap-1 tw-flex-1 tw-overflow-x-auto tw-py-1"
    cdkDropList
    cdkDropListOrientation="horizontal"
    (cdkDropListDropped)="onDropped($event)"
  >
    @for (frame of frames(); track frame.id; let i = $index) {
      <div
        class="tw-relative tw-flex tw-flex-col tw-items-center tw-gap-0.5 tw-p-0.5 tw-rounded-sm tw-border tw-cursor-pointer hover:tw-bg-muted"
        [class.tw-border-accent]="selectedFrameId() === frame.id"
        [class.tw-border-border]="selectedFrameId() !== frame.id"
        cdkDrag
        tabindex="0"
        (click)="frameSelect.emit(frame.id)"
        (keydown.enter)="frameSelect.emit(frame.id)"
        (keydown.space)="frameSelect.emit(frame.id); $event.preventDefault()"
        [title]="frame.name"
      >
        <div
          class="tw-w-8 tw-h-8 tw-bg-[length:100%_100%] tw-bg-center tw-bg-no-repeat tw-rounded-sm"
          [style.background-image]="'url(' + frame.pixelData + ')'"
        ></div>
        <span class="tw-text-[10px] tw-text-muted-foreground">{{ i + 1 }}</span>
        <ng-container *cdkDragPreview>
          <div class="rk-frame-preview tw-w-8 tw-h-8 tw-bg-[length:100%_100%] tw-bg-center tw-bg-no-repeat"
               [style.background-image]="'url(' + frame.pixelData + ')'"></div>
        </ng-container>
        <ng-container *cdkDragPlaceholder>
          <div class="rk-frame-placeholder tw-w-8 tw-h-8"></div>
        </ng-container>
      </div>
    }
  </div>
  ```
- Remove `draggable` attribute and `(dragstart)`, `(dragover)`, `(drop)`,
  `(dragend)` handlers.

### `frame-strip.component.scss`

Follow the existing `scene-list.component.scss` pattern:

```scss
.cdk-drag-preview {
  opacity: 0.9;
  outline: 1px solid var(--border);
  border-radius: 0.125rem;
}

.cdk-drag-placeholder {
  opacity: 0.3;
}
```

Note: `*cdkDragPreview` content is rendered inside a `.cdk-drag-preview`
container and `*cdkDragPlaceholder` inside `.cdk-drag-placeholder`; the
component-level classes above ensure consistent sizing and appearance.

## Constraints & gotchas

- **No bare `tw-transition`** on `cdkDrag` items: CDK clones the drag root as the
  preview, and a multi-property transition on it crashes (same rule enforced by
  `scene-list.component.spec.ts`). The current frame markup has no transition
  class, so nothing to remove, but avoid adding one.
- `CdkDropList` must be imported in the component imports array; `cdkDropList`,
  `cdkDrag`, `*cdkDragPreview`, `*cdkDragPlaceholder` all need their directives.
- The `sprite-editor.component.ts` `onFrameReorder(fromIndex, toIndex)` already
  receives `[fromIndex, toIndex]` from `frameReorder`, so no change is needed at
  the parent level.

## Testing

No `frame-strip.component.spec.ts` exists today. Create one covering:

1. Renders one item per `frames` input.
2. Click on a frame emits `frameSelect` with the frame id.
3. `onDropped` with `{ previousIndex: 0, currentIndex: 2 }` emits
   `frameReorder` with `[0, 2]`.
4. `onDropped` with `previousIndex === currentIndex` does not emit.

## Out of scope

- Reordering tiles in the tile manager (no drag & drop there; still click + arrows).
- Scene list reordering (already on CDK).
- Any parent (`sprite-editor.component.ts`) logic change.