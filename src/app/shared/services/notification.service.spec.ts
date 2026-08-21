import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should add an error message', () => {
    service.error('Something went wrong');
    const msgs = service.messages();
    expect(msgs.length).toBe(1);
    expect(msgs[0].message).toBe('Something went wrong');
    expect(msgs[0].type).toBe('error');
  });

  it('should add a success message', () => {
    service.success('Saved!');
    const msgs = service.messages();
    expect(msgs.length).toBe(1);
    expect(msgs[0].type).toBe('success');
  });

  it('should dismiss by id', () => {
    service.error('First');
    service.error('Second');
    const msgs = service.messages();
    expect(msgs.length).toBe(2);
    service.dismiss(msgs[0].id);
    expect(service.messages().length).toBe(1);
    expect(service.messages()[0].message).toBe('Second');
  });

  it('should auto-dismiss after 5 seconds', () => {
    vi.useFakeTimers();
    service.info('Auto dismiss');
    expect(service.messages().length).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(service.messages().length).toBe(0);
    vi.useRealTimers();
  });
});
