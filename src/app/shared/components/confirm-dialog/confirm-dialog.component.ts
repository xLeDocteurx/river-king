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
