import { Injectable, inject } from '@angular/core';
import { UndoService } from './undo.service';

/**
 * App-wide keyboard shortcut handling.
 *
 * Binds `Ctrl/Cmd+Z` to undo and `Ctrl/Cmd+Shift+Z` to redo on the shared
 * undo stack. Inputs are ignored while the focus sits inside an editable
 * element (input, textarea, select or contenteditable) so global shortcuts
 * never conflict with text editing.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService {
  private readonly undo = inject(UndoService);
  private readonly listener = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (key !== 'z') return;
    const mod = event.ctrlKey || event.metaKey;
    if (!mod || event.altKey) return;
    if (this.isEditableTarget(event.target)) return;
    event.preventDefault();
    if (event.shiftKey) {
      this.undo.redo();
    } else {
      this.undo.undo();
    }
  };

  constructor() {
    document.addEventListener('keydown', this.listener);
  }

  /** @internal Detaches the keydown listener (used in tests). */
  destroy(): void {
    document.removeEventListener('keydown', this.listener);
  }

  /**
   * Whether the event target is an editable form control.
   * @param target - The DOM event target.
   * @returns True when the target is an input, textarea, select or contenteditable element.
   */
  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return true;
    }
    return target.isContentEditable;
  }
}
