import { Component, ChangeDetectionStrategy, viewChild, input, output } from '@angular/core';
import { DialogComponent } from '../dialog/dialog.component';

/**
 * Data payload for a confirmation dialog.
 */
export interface ConfirmDialogData {
  /** Dialog title. */
  title: string;
  /** Dialog message body. */
  message: string;
  /** Optional label for the confirm button (defaults to 'Delete'). */
  confirmLabel?: string;
  /** Optional label for the cancel button (defaults to 'Cancel'). */
  cancelLabel?: string;
}

/**
 * Reusable confirmation dialog backed by the native `<dialog>` element.
 *
 * Wraps `DialogComponent` to provide a pre-styled confirmation layout.
 * Consumers call `open()` / `close()` programmatically via a template reference.
 *
 * @example
 * <rk-confirm-dialog #confirm (confirmed)="doDelete()" (cancelled)="hide()">
 * </rk-confirm-dialog>
 * <button (click)="confirm.open()">Delete</button>
 */
@Component({
  selector: 'rk-confirm-dialog',
  standalone: true,
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  /** Reference to the inner dialog wrapper. */
  private readonly dialog = viewChild.required(DialogComponent);

  /** Configuration data shown in the dialog. */
  data = input.required<ConfirmDialogData>();

  /** Emitted when the user presses the confirm button. */
  confirmed = output<void>();

  /** Emitted when the user presses the cancel button or closes the dialog. */
  cancelled = output<void>();

  /** Tracks whether the confirm button was just clicked so we don't emit cancelled after a confirmation. */
  private confirmedClicked = false;

  /** Opens the confirmation dialog as a modal. */
  open(): void {
    this.confirmedClicked = false;
    this.dialog().open();
  }

  /** Closes the dialog programmatically. */
  close(): void {
    this.dialog().close();
  }

  /** @internal Called when the dialog emits its native close event. */
  onDialogClosed(): void {
    if (!this.confirmedClicked) {
      this.cancelled.emit();
    }
    this.confirmedClicked = false;
  }

  /** @internal Called when the user explicitly confirms. */
  onConfirm(): void {
    this.confirmedClicked = true;
    this.close();
    this.confirmed.emit();
  }

  /**
   * @internal Called when the user explicitly cancels.
   * Only closes: the native close event triggers {@link onDialogClosed},
   * which emits `cancelled` exactly once.
   */
  onCancel(): void {
    this.close();
  }
}
