import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  message: string;
  type: 'error' | 'success' | 'info' | 'warning';
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private _idCounter = 0;
  readonly messages = signal<ToastMessage[]>([]);

  show(message: string, type: ToastMessage['type']): void {
    const id = ++this._idCounter;
    this.messages.update((msgs) => [...msgs, { id, message, type }]);
    setTimeout(() => this.dismiss(id), 5000);
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  warning(message: string): void {
    this.show(message, 'warning');
  }

  dismiss(id: number): void {
    this.messages.update((msgs) => msgs.filter((m) => m.id !== id));
  }
}
