import { TestBed } from '@angular/core/testing';
import { UndoService, UndoableAction } from './undo.service';

function buildAction(label: string): UndoableAction {
  return {
    label,
    execute: vi.fn(() => undefined),
    undo: vi.fn(() => undefined),
  };
}

describe('UndoService', () => {
  let service: UndoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UndoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('starts with empty stacks and signals', () => {
    expect(service.canUndo()).toBe(false);
    expect(service.canRedo()).toBe(false);
    expect(service.undoLabel()).toBe('');
    expect(service.redoLabel()).toBe('');
  });

  it('tracks the label of the action at the top of the undo stack', () => {
    service.push(buildAction('Place tile'));
    service.push(buildAction('Remove sprite'));

    expect(service.undoLabel()).toBe('Remove sprite');
  });

  it('never executes an action when it is pushed', () => {
    const action = buildAction('Place tile');

    service.push(action);

    expect(action.execute).not.toHaveBeenCalled();
    expect(action.undo).not.toHaveBeenCalled();
  });

  it('invokes undo and moves the action to the redo stack', () => {
    const action = buildAction('Place tile');
    service.push(action);

    service.undo();

    expect(action.undo).toHaveBeenCalledTimes(1);
    expect(service.canUndo()).toBe(false);
    expect(service.canRedo()).toBe(true);
    expect(service.redoLabel()).toBe('Place tile');
  });

  it('invokes execute when redoing and restores the undo stack', () => {
    const action = buildAction('Place tile');
    service.push(action);
    service.undo();

    service.redo();

    expect(action.execute).toHaveBeenCalledTimes(1);
    expect(service.canUndo()).toBe(true);
    expect(service.canRedo()).toBe(false);
    expect(service.undoLabel()).toBe('Place tile');
  });

  it('undoes actions in LIFO order', () => {
    const first = buildAction('First');
    const second = buildAction('Second');
    service.push(first);
    service.push(second);

    service.undo();
    service.undo();

    expect(second.undo).toHaveBeenCalledTimes(1);
    expect(first.undo).toHaveBeenCalledTimes(1);
    expect(service.canUndo()).toBe(false);
  });

  it('is a no-op when undoing an empty stack', () => {
    expect(() => service.undo()).not.toThrow();
    expect(service.canUndo()).toBe(false);
    expect(service.canRedo()).toBe(false);
  });

  it('is a no-op when redoing an empty stack', () => {
    expect(() => service.redo()).not.toThrow();
    expect(service.canUndo()).toBe(false);
    expect(service.canRedo()).toBe(false);
  });

  it('clears the redo stack when a new action is pushed', () => {
    service.push(buildAction('First'));
    service.undo();

    service.push(buildAction('Second'));

    expect(service.canRedo()).toBe(false);
    expect(service.redoLabel()).toBe('');
    expect(service.undoLabel()).toBe('Second');
  });

  it('clears all history', () => {
    service.push(buildAction('First'));
    service.push(buildAction('Second'));

    service.clear();

    expect(service.canUndo()).toBe(false);
    expect(service.canRedo()).toBe(false);
    expect(service.undoLabel()).toBe('');
    expect(service.redoLabel()).toBe('');
  });

  it('drops the oldest action once the history limit is reached', () => {
    const first = buildAction('action-1');
    for (let i = 2; i <= 101; i += 1) {
      service.push(buildAction(`action-${i}`));
    }

    expect(service.canUndo()).toBe(true);
    expect(service.undoLabel()).toBe('action-101');

    for (let i = 0; i < 100; i += 1) {
      service.undo();
    }

    expect(service.canUndo()).toBe(false);
    expect(first.undo).not.toHaveBeenCalled();
  });

  it('supports a full undo/redo round trip', () => {
    const first = buildAction('First');
    const second = buildAction('Second');
    service.push(first);
    service.push(second);

    service.undo();
    service.undo();
    service.redo();
    service.redo();

    expect(second.undo).toHaveBeenCalledTimes(1);
    expect(first.undo).toHaveBeenCalledTimes(1);
    expect(first.execute).toHaveBeenCalledTimes(1);
    expect(second.execute).toHaveBeenCalledTimes(1);
    expect(service.canUndo()).toBe(true);
    expect(service.canRedo()).toBe(false);
  });
});
