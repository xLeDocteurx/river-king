import { Injectable, signal } from '@angular/core';

/**
 * Represents a toast notification displayed to the user.
 */
export interface ToastMessage {
  /** Unique identifier used to dismiss the toast. */
  id: number;
  /** Text content displayed in the toast. */
  message: string;
  /** Visual style and semantic meaning of the toast. */
  type: 'error' | 'success' | 'info' | 'warning';
}

/**
 * Manages in-app toast notifications via a reactive signal queue.
 *
 * Toasts auto-dismiss after 5 seconds. The component tree reads the
 * `messages` signal to render active toasts.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private _idCounter = 0;

  /** Active toast messages. Updated reactively by show/dismiss calls. */
  readonly messages = signal<ToastMessage[]>([]);

  /**
   * Display a toast with the given message and type.
   *
   * The toast is automatically dismissed after 5 seconds.
   *
   * @param message - Text content to display.
   * @param type - Severity level controlling the toast's visual style.
   */
  show(message: string, type: ToastMessage['type']): void {
    const id = ++this._idCounter;
    this.messages.update((msgs) => [...msgs, { id, message, type }]);
    setTimeout(() => this.dismiss(id), 5000);
  }

  /**
   * Show an error toast.
   *
   * @param message - Error description to display.
   */
  error(message: string): void {
    this.show(message, 'error');
  }

  /**
   * Show a success toast.
   *
   * @param message - Success message to display.
   */
  success(message: string): void {
    this.show(message, 'success');
  }

  /**
   * Show an informational toast.
   *
   * @param message - Informational text to display.
   */
  info(message: string): void {
    this.show(message, 'info');
  }

  /**
   * Show a warning toast.
   *
   * @param message - Warning text to display.
   */
  warning(message: string): void {
    this.show(message, 'warning');
  }

  /**
   * Remove a toast from the active queue by its identifier.
   *
   * @param id - The toast's unique identifier.
   */
  dismiss(id: number): void {
    this.messages.update((msgs) => msgs.filter((m) => m.id !== id));
  }
}
