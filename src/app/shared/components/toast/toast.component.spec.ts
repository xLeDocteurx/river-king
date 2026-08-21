import { TestBed } from '@angular/core/testing';
import { ToastComponent } from './toast.component';
import { NotificationService } from '../../services/notification.service';

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
});
