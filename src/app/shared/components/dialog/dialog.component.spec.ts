import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DialogComponent } from './dialog.component';

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

@Component({
  selector: 'rk-dialog-host',
  standalone: true,
  imports: [DialogComponent],
  template:
    '<rk-dialog dialogClass="host-dialog"><p class="projected">Hello dialog</p></rk-dialog>',
})
class DialogHostComponent {}

describe('DialogComponent', () => {
  let fixture: ComponentFixture<DialogComponent>;
  let dialog: HTMLDialogElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogComponent, DialogHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DialogComponent);
    fixture.detectChanges();
    dialog = fixture.debugElement.query(By.css('dialog')).nativeElement as HTMLDialogElement;
  });

  it('renders a native <dialog> element with the rk-dialog class', () => {
    expect(dialog).toBeInstanceOf(HTMLDialogElement);
    expect(dialog.className).toContain('rk-dialog');
  });

  it('applies the dialogClass input onto the dialog element', () => {
    fixture.componentRef.setInput('dialogClass', 'my-extra-class');
    fixture.detectChanges();

    expect(dialog.className).toContain('rk-dialog');
    expect(dialog.className).toContain('my-extra-class');
  });

  it('open() calls showModal on the native dialog', () => {
    const showModal = vi.spyOn(dialog, 'showModal');

    fixture.componentInstance.open();

    expect(showModal).toHaveBeenCalledTimes(1);
  });

  it('close() calls the native close with the return value', () => {
    const close = vi.spyOn(dialog, 'close');

    fixture.componentInstance.close('accepted');

    expect(close).toHaveBeenCalledWith('accepted');
  });

  it('emits closed with the returnValue on the native close event', () => {
    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.closed.subscribe((value) => emitted.push(value));
    dialog.returnValue = 'confirmed';

    dialog.dispatchEvent(new Event('close'));

    expect(emitted).toEqual(['confirmed']);
  });

  it('emits closed after close(value) through the native close event', () => {
    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.closed.subscribe((value) => emitted.push(value));

    fixture.componentInstance.close('escape-result');

    expect(emitted).toEqual(['escape-result']);
  });

  it('projects content into the dialog and forwards dialogClass', () => {
    const hostFixture = TestBed.createComponent(DialogHostComponent);
    hostFixture.detectChanges();

    const projected = (hostFixture.nativeElement as HTMLElement).querySelector('.projected');
    const hostDialog = hostFixture.debugElement.query(By.css('dialog'))
      .nativeElement as HTMLDialogElement;

    expect(projected?.textContent).toBe('Hello dialog');
    expect(hostDialog.className).toContain('host-dialog');
  });
});
