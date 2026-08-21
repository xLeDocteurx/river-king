import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NotificationService, type ToastMessage } from '../../services/notification.service';

@Component({
  selector: 'rk-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="tw-fixed tw-top-4 tw-right-4 tw-z-[100] tw-flex tw-flex-col tw-gap-2"
      role="region"
      aria-label="Notifications"
    >
      @for (msg of messages(); track msg.id) {
        <div
          class="tw-flex tw-items-start tw-gap-3 tw-min-w-[20rem] tw-max-w-[24rem] tw-rounded-md tw-border tw-shadow-lg tw-px-4 tw-py-3"
          [class.tw-bg-destructive]="msg.type === 'error'"
          [class.tw-bg-green-600]="msg.type === 'success'"
          [class.tw-bg-blue-600]="msg.type === 'info'"
          [class.tw-bg-yellow-600]="msg.type === 'warning'"
          [class.tw-text-white]="true"
          [class.tw-border-transparent]="true"
          role="alert"
        >
          <span class="material-symbols" aria-hidden="true">
            {{ iconFor(msg.type) }}
          </span>
          <span class="tw-flex-1 tw-text-sm">{{ msg.message }}</span>
          <button
            type="button"
            (click)="dismiss(msg.id)"
            class="tw-p-1 tw-rounded-md hover:tw-bg-white/20 tw-transition tw-leading-none"
            aria-label="Close notification"
          >
            <span class="material-symbols" aria-hidden="true">close</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  private readonly notificationService = inject(NotificationService);

  messages = this.notificationService.messages;

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

  dismiss(id: number): void {
    this.notificationService.dismiss(id);
  }
}
