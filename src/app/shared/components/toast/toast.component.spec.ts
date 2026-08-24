import { TestBed } from '@angular/core/testing';
import { ToastComponent } from './toast.component';
import { NotificationService } from '../../../core/services/notification.service';

describe('ToastComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ToastComponent>>;
  let notification: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ToastComponent],
    });
    fixture = TestBed.createComponent(ToastComponent);
    notification = TestBed.inject(NotificationService);
    notification.messages.set([]);
    fixture.detectChanges();
  });

  it('should render toast messages', () => {
    notification.error('Test error');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Test error');
  });

  it('should dismiss on close button click', () => {
    notification.error('Dismiss me');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector('button[aria-label="Close notification"]') as HTMLButtonElement;
    btn?.click();
    fixture.detectChanges();
    expect(notification.messages()).toHaveLength(0);
  });

  it('styles toasts on-token with a type-colored left edge', () => {
    notification.error('Boom');
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.className).toContain('tw-rounded-sm');
    expect(alert.className).toContain('tw-bg-card-bg');
    expect(alert.className).toContain('tw-border-l-destructive');
    expect(alert.className).not.toContain('shadow');
  });

  it('uses primary edge for success', () => {
    notification.success('Saved');
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.className).toContain('tw-border-l-primary');
  });
});
