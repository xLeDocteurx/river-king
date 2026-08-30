import { TestBed } from '@angular/core/testing';
import { KeyboardShortcutsService } from './keyboard-shortcuts.service';
import { UndoService } from './undo.service';

describe('KeyboardShortcutsService', () => {
  let service: KeyboardShortcutsService;
  let undo: UndoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [KeyboardShortcutsService, UndoService],
    });
    service = TestBed.inject(KeyboardShortcutsService);
    undo = TestBed.inject(UndoService);
  });

  afterEach(() => {
    service.destroy();
  });

  function pushFakeAction(label: string): void {
    undo.push({ label, execute: () => undefined, undo: () => undefined });
  }

  function dispatchKey(options: KeyboardEventInit): void {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...options }),
    );
  }

  it('triggers undo with Ctrl+Z', () => {
    pushFakeAction('Alpha');
    expect(undo.undoLabel()).toBe('Alpha');
    dispatchKey({ key: 'z', ctrlKey: true });
    expect(undo.undoLabel()).toBe('');
    expect(undo.canRedo()).toBe(true);
  });

  it('triggers undo with Cmd+Z', () => {
    pushFakeAction('Alpha');
    dispatchKey({ key: 'z', metaKey: true });
    expect(undo.undoLabel()).toBe('');
  });

  it('triggers redo with Ctrl+Shift+Z', () => {
    pushFakeAction('Alpha');
    dispatchKey({ key: 'z', ctrlKey: true });
    expect(undo.canRedo()).toBe(true);
    dispatchKey({ key: 'z', ctrlKey: true, shiftKey: true });
    expect(undo.canRedo()).toBe(false);
    expect(undo.undoLabel()).toBe('Alpha');
  });

  it('ignores Ctrl+Z when pressing a different key', () => {
    pushFakeAction('Alpha');
    dispatchKey({ key: 'y', ctrlKey: true });
    expect(undo.undoLabel()).toBe('Alpha');
  });

  it('ignores Ctrl+Z while an input field is focused', () => {
    pushFakeAction('Alpha');
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'z', ctrlKey: true }),
    );
    expect(undo.undoLabel()).toBe('Alpha');
    input.remove();
  });

  it('does nothing when Ctrl is not pressed', () => {
    pushFakeAction('Alpha');
    dispatchKey({ key: 'z' });
    expect(undo.undoLabel()).toBe('Alpha');
  });

  it('destroys the listener and stops reacting', () => {
    pushFakeAction('Alpha');
    const spy = vi.spyOn(undo, 'undo');
    service.destroy();
    dispatchKey({ key: 'z', ctrlKey: true });
    expect(spy).not.toHaveBeenCalled();
  });
});
