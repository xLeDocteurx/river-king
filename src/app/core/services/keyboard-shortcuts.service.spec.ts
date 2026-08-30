import { TestBed } from '@angular/core/testing';
import { KeyboardShortcutsService, ShortcutId } from './keyboard-shortcuts.service';

describe('KeyboardShortcutsService', () => {
  let service: KeyboardShortcutsService;

  /** Dispatches a keydown and returns the shortcut ids emitted synchronously. */
  function press(key: string, options: KeyboardEventInit = {}): ShortcutId[] {
    const received: ShortcutId[] = [];
    const subscription = service.shortcuts.subscribe((id) => received.push(id));
    document.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true, ...options }));
    subscription.unsubscribe();
    return received;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(KeyboardShortcutsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('maps Ctrl+Z to undo', () => {
    expect(press('z', { ctrlKey: true })).toEqual(['undo']);
  });

  it('maps Meta+Z to undo', () => {
    expect(press('z', { metaKey: true })).toEqual(['undo']);
  });

  it('maps Ctrl+Shift+Z to redo', () => {
    expect(press('z', { ctrlKey: true, shiftKey: true })).toEqual(['redo']);
  });

  it('maps Ctrl+Y to redo', () => {
    expect(press('y', { ctrlKey: true })).toEqual(['redo']);
  });

  it('maps Ctrl+S to save and prevents its default', () => {
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
    const received: ShortcutId[] = [];
    const subscription = service.shortcuts.subscribe((id) => received.push(id));
    document.dispatchEvent(event);
    subscription.unsubscribe();
    expect(received).toEqual(['save']);
    expect(event.defaultPrevented).toBe(true);
  });

  it('maps Delete to delete', () => {
    expect(press('Delete')).toEqual(['delete']);
  });

  it('maps digit keys to drawing tools', () => {
    expect(press('1')).toEqual(['tool.brush']);
    expect(press('2')).toEqual(['tool.eraser']);
    expect(press('3')).toEqual(['tool.fill']);
  });

  it('ignores modifier-key combinations it does not know about', () => {
    expect(press('Delete', { ctrlKey: true })).toEqual([]);
  });

  it('ignores keys pressed while typing in an input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    input.remove();
    const received: ShortcutId[] = [];
    const subscription = service.shortcuts.subscribe((id) => received.push(id));
    expect(received).toEqual([]);
    subscription.unsubscribe();
  });

  it('ignores keys pressed while typing in a textarea', () => {
    const received: ShortcutId[] = [];
    const subscription = service.shortcuts.subscribe((id) => received.push(id));
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
    );
    textarea.remove();
    expect(received).toEqual([]);
    subscription.unsubscribe();
  });

  it('ignores keys pressed inside a select', () => {
    const selected: ShortcutId[] = [];
    const subscription = service.shortcuts.subscribe((id) => selected.push(id));
    const select = document.createElement('select');
    document.body.appendChild(select);
    select.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    select.remove();
    expect(selected).toEqual([]);
    subscription.unsubscribe();
  });

  it('ignores keys pressed inside a contenteditable region', () => {
    const selected: ShortcutId[] = [];
    const subscription = service.shortcuts.subscribe((id) => selected.push(id));
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.appendChild(editable);
    editable.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
    );
    editable.remove();
    expect(selected).toEqual([]);
    subscription.unsubscribe();
  });

  it('ignores auto-repeated keydown events', () => {
    expect(press('Delete', { repeat: true })).toEqual([]);
  });
});
