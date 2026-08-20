# Task 5: Shared Confirm Dialog

**Files:**

- Create: `src/app/shared/components/confirm-dialog/confirm-dialog.component.ts`
- Create: `src/app/shared/components/confirm-dialog/confirm-dialog.component.spec.ts`

**Context:**
This is Task 5 of an Angular 22 game engine build. Tasks 1-4 are complete (Database, Models, ProjectService, Routing). This component is a reusable confirmation dialog used before any deletion in the app. Per project constraints: ALL deletions require a confirmation modal.

**Global Constraints (apply):**
- ChangeDetectionStrategy.OnPush
- Standalone components (imports in @Component())
- Tailwind CSS prefix: `tw-`
- Component selector prefix: `rk-`
- Headless shared components should accept a `class` input for styling flexibility
- Use Angular signals (input(), output())
- `darkMode: 'class'` via `.dark` class on `<html>`
- Material Symbols icons loaded via `@material-symbols/font-400`

---

## Step 1: Implement ConfirmDialogComponent

Create: `src/app/shared/components/confirm-dialog/confirm-dialog.component.ts`

```typescript
import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

@Component({
  selector: 'rk-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-flex tw-flex-col tw-gap-4 tw-p-6 tw-max-w-md">
      <div class="tw-flex tw-items-center tw-gap-2">
        <span class="material-symbols tw-text-destructive" aria-hidden="true">warning</span>
        <h2 class="tw-text-lg tw-font-bold tw-text-foreground">{{ data().title }}</h2>
      </div>
      <p class="tw-text-muted-foreground">{{ data().message }}</p>
      <div class="tw-flex tw-justify-end tw-gap-2">
        <button
          type="button"
          (click)="cancelled.emit()"
          class="tw-px-4 tw-py-2 tw-rounded-md tw-border tw-border-border tw-bg-background tw-text-foreground tw-transition hover:tw-bg-muted"
        >
          {{ data().cancelLabel || 'Cancel' }}
        </button>
        <button
          type="button"
          (click)="confirmed.emit()"
          class="tw-px-4 tw-py-2 tw-rounded-md tw-bg-destructive tw-text-white tw-transition hover:tw-opacity-90"
        >
          {{ data().confirmLabel || 'Delete' }}
        </button>
      </div>
    </div>
  `,
})
export class ConfirmDialogComponent {
  data = input.required<ConfirmDialogData>();
  confirmed = output<void>();
  cancelled = output<void>();
}
```

---

## Step 2: Write tests

Create: `src/app/shared/components/confirm-dialog/confirm-dialog.component.spec.ts`

Test cases:
1. Should render title and message from input
2. Should emit `confirmed` when confirm button clicked
3. Should emit `cancelled` when cancel button clicked
4. Should use default labels when not provided
5. Should use custom labels when provided

Setup: Use `TestBed.configureTestingModule({ imports: [ConfirmDialogComponent] })`.

---

## Step 3: Run tests and lint

Run: `cd /home/lenoir/river-king && devbox run npm run test`
Expected: PASS (3 test files, ~16 tests total)

Run: `cd /home/lenoir/river-king && devbox run npm run lint`
Expected: PASS

---

## Step 4: Commit

```bash
cd /home/lenoir/river-king
git add src/app/shared/components/confirm-dialog/
git commit -m "feature-5-confirm-dialog: add shared confirm dialog component"
```

---

**Report file:** Write to `docs/superpowers/plans/task-5-report.md`:
- Status: DONE / DONE_WITH_CONCERNS / BLOCKED
- Files created/modified
- Test results: pass/fail + count
- Lint results
- Git commit hash
- Any issues encountered
