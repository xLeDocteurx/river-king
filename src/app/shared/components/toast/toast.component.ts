import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NotificationService, type ToastMessage } from '../../services/notification.service';

/**
 * Renders floating toast notifications using the notification service.
 */
@Component({
  selector: 'rk-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  private readonly notificationService = inject(NotificationService);

  /** Reactive list of active toast messages from the notification service. */
  messages = this.notificationService.messages;

  /**
   * Selects a Material Symbol icon name for the given toast type.
   * @param type Toast message type.
   * @returns Name of the Material Symbol to display.
   */
  iconFor(type: ToastMessage['type']): string {
    switch (type) {
      case 'error':
        return 'error';
      case 'success':
        return 'check_circle';
      case 'warning':
        return 'warning';
      case 'info':
      default:
        return 'info';
    }
  }

  /**
   * Removes the specified toast message.
   * @param id Message identifier to dismiss.
   */
  dismiss(id: number): void {
    this.notificationService.dismiss(id);
  }
}
