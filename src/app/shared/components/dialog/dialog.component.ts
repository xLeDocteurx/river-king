import {
  Component,
  ElementRef,
  ChangeDetectionStrategy,
  viewChild,
  output,
  input,
} from '@angular/core';

/**
 * Reusable native HTML `<dialog>` wrapper.
 *
 * Uses the browser's built-in modal behavior: focus trap, Escape handling,
 * and `::backdrop` styling. Consumers call `open()` and listen to `(closed)`.
 *
 * @example
 * <rk-dialog #dialog (closed)="handleClose($event)">
 *   <h2>My title</h2>
 *   <p>Content</p>
 * </rk-dialog>
 *
 * <button (click)="dialog.open()">Open</button>
 */
@Component({
  selector: 'rk-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.scss',
})
export class DialogComponent {
  /**
   * Reference to the native `<dialog>` element.
   */
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /**
   * Optional additional CSS class applied to the `<dialog>` element.
   */
  dialogClass = input<string>('');

  /**
   * Emitted when the dialog is closed (programmatically, via Escape, or backdrop click).
   * Carries the optional `returnValue` set by `close(value?)`.
   */
  closed = output<string | undefined>();

  /**
   * Opens the dialog as a modal (with backdrop and focus trap).
   */
  open(): void {
    this.dialogRef().nativeElement.showModal();
  }

  /**
   * Closes the dialog and fires the `closed` output.
   * @param value Optional return value passed to the close event.
   */
  close(value?: string): void {
    this.dialogRef().nativeElement.close(value);
  }

  /**
   * Handles the native `close` event from the `<dialog>` element.
   * @internal
   */
  onDialogClose(): void {
    this.closed.emit(this.dialogRef().nativeElement.returnValue);
  }
}
