import { TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';

// jsdom does not implement HTMLDialogElement methods
const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
if (typeof dialogProto['showModal'] !== 'function') {
  dialogProto['showModal'] = function () {
    // no-op
  };
}
if (typeof dialogProto['close'] !== 'function') {
  dialogProto['close'] = function (returnValue?: string) {
    (this as unknown as HTMLDialogElement).returnValue = returnValue ?? '';
    (this as unknown as HTMLDialogElement).dispatchEvent(new Event('close'));
  };
}

describe('ConfirmDialogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
    }).compileComponents();
  });

  it('should render title and message from input', async () => {
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.componentRef.setInput('data', {
      title: 'Delete Project',
      message: 'Are you sure you want to delete this project?',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent?.trim()).toBe('Delete Project');
    expect(compiled.querySelector('p')?.textContent?.trim()).toBe(
      'Are you sure you want to delete this project?',
    );
  });

  it('should emit confirmed when confirm button clicked', async () => {
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.componentRef.setInput('data', { title: 'Test', message: 'Test message' });
    await fixture.whenStable();
    fixture.detectChanges();

    let emitted = false;
    fixture.componentInstance.confirmed.subscribe(() => {
      emitted = true;
    });

    const compiled = fixture.nativeElement as HTMLElement;
    const confirmButton = compiled.querySelectorAll('button')[1];
    confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(emitted).toBe(true);
  });

  it('should emit cancelled when cancel button clicked', async () => {
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.componentRef.setInput('data', { title: 'Test', message: 'Test message' });
    await fixture.whenStable();
    fixture.detectChanges();

    let emitted = false;
    fixture.componentInstance.cancelled.subscribe(() => {
      emitted = true;
    });

    const compiled = fixture.nativeElement as HTMLElement;
    const cancelButton = compiled.querySelectorAll('button')[0];
    cancelButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(emitted).toBe(true);
  });

  it('should use default labels when not provided', async () => {
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.componentRef.setInput('data', { title: 'Test', message: 'Test message' });
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('button');
    expect(buttons[0].textContent?.trim()).toBe('Cancel');
    expect(buttons[1].textContent?.trim()).toBe('Delete');
  });

  it('should use custom labels when provided', async () => {
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.componentRef.setInput('data', {
      title: 'Test',
      message: 'Test message',
      confirmLabel: 'Yes, remove',
      cancelLabel: 'No, keep',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('button');
    expect(buttons[0].textContent?.trim()).toBe('No, keep');
    expect(buttons[1].textContent?.trim()).toBe('Yes, remove');
  });
});
