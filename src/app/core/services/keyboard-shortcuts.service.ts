import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Subject, Observable } from 'rxjs';

/** The set of editor shortcuts that can be triggered via the keyboard. */
export type ShortcutId =
  | 'undo'
  | 'redo'
  | 'delete'
  | 'save'
  | 'tool.brush'
  | 'tool.eraser'
  | 'tool.fill';

/**
 * Listens for global keyboard shortcuts and broadcasts them as a typed stream.
 *
 * Shortcuts never fire while the user is typing in an input, a textarea, a
 * select or a contenteditable region, nor for auto-repeated keydown events.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService {
  private readonly shortcuts$ = new Subject<ShortcutId>();
  private readonly document = inject(DOCUMENT);

  /** Emits an identifier each time a known shortcut is pressed. */
  readonly shortcuts: Observable<ShortcutId> = this.shortcuts$.asObservable();

  constructor() {
    this.document.addEventListener('keydown', (event) => {
      if (!this.accepts(event)) {
        return;
      }
      const id = this.match(event);
      if (!id) {
        return;
      }
      event.preventDefault();
      this.shortcuts$.next(id);
    });
  }

  /**
   * Determines whether a keydown event should be considered for shortcuts.
   * @param event - The keydown event.
   * @returns True when the event can trigger a shortcut.
   */
  private accepts(event: KeyboardEvent): boolean {
    if (event.repeat) {
      return false;
    }
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return false;
    }
    if (target instanceof HTMLElement && target.isContentEditable) {
      return false;
    }
    if (target instanceof HTMLElement && target.getAttribute('contenteditable') !== null) {
      return false;
    }
    return true;
  }

  /**
   * Maps a keydown event to a shortcut identifier.
   * @param event - The keydown event.
   * @returns The matching shortcut id, or null when the key is not a shortcut.
   */
  private match(event: KeyboardEvent): ShortcutId | null {
    const mod = event.ctrlKey || event.metaKey;
    if (mod) {
      if (event.key.toLowerCase() === 'z') {
        return event.shiftKey ? 'redo' : 'undo';
      }
      if (event.key.toLowerCase() === 'y') {
        return 'redo';
      }
      if (event.key.toLowerCase() === 's') {
        return 'save';
      }
      return null;
    }
    if (event.shiftKey || event.altKey || event.metaKey) {
      return null;
    }
    switch (event.key) {
      case 'Delete':
        return 'delete';
      case '1':
        return 'tool.brush';
      case '2':
        return 'tool.eraser';
      case '3':
        return 'tool.fill';
      default:
        return null;
    }
  }
}