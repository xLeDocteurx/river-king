import { Injectable, signal } from '@angular/core';

/**
 * A reversible editor action. Implementations capture the state needed
 * to undo and redo the operation.
 */
export interface UndoableAction {
  /** Human-readable label shown in the UI (e.g. "Place tile"). */
  readonly label: string;
  /** Re-apply the action. */
  execute(): void;
  /** Reverse the action, restoring the previous state. */
  undo(): void;
}

const MAX_STACK_SIZE = 100;

/**
 * Global undo/redo stack. Features push {@link UndoableAction} instances
 * after performing mutations; the service manages the two stacks and
 * exposes reactive signals for UI binding.
 */
@Injectable({ providedIn: 'root' })
export class UndoService {
  private undoStack: UndoableAction[] = [];
  private redoStack: UndoableAction[] = [];

  /** Whether undo is available. */
  readonly canUndo = signal(false);
  /** Whether redo is available. */
  readonly canRedo = signal(false);
  /** Label of the action that would be undone (empty when stack is empty). */
  readonly undoLabel = signal('');
  /** Label of the action that would be redone (empty when stack is empty). */
  readonly redoLabel = signal('');

  /**
   * Push a new action onto the undo stack and clear the redo stack.
   * The action is NOT executed — the caller is responsible for running
   * it first and pushing only after the mutation succeeds.
   * @param action - The reversible action to record.
   */
  push(action: UndoableAction): void {
    this.undoStack.push(action);
    if (this.undoStack.length > MAX_STACK_SIZE) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.syncSignals();
  }

  /** Undo the most recent action. */
  undo(): void {
    const action = this.undoStack.pop();
    if (!action) return;
    action.undo();
    this.redoStack.push(action);
    this.syncSignals();
  }

  /** Redo the most recently undone action. */
  redo(): void {
    const action = this.redoStack.pop();
    if (!action) return;
    action.execute();
    this.undoStack.push(action);
    this.syncSignals();
  }

  /** Clear all history (e.g. when switching projects). */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.syncSignals();
  }

  private syncSignals(): void {
    this.canUndo.set(this.undoStack.length > 0);
    this.canRedo.set(this.redoStack.length > 0);
    this.undoLabel.set(
      this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1].label : '',
    );
    this.redoLabel.set(
      this.redoStack.length > 0 ? this.redoStack[this.redoStack.length - 1].label : '',
    );
  }
}
