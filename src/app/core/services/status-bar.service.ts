import { Injectable, signal } from '@angular/core';

/**
 * Holds the contextual label shown on the left side of the app-wide
 * status bar. Features push short context strings (e.g. "3 projects",
 * a scene name); the right side ("River King Engine") is owned by the
 * root component and not part of this service's state.
 */
@Injectable({ providedIn: 'root' })
export class StatusBarService {
  /** Current contextual label displayed on the status bar's left side. */
  readonly context = signal<string>('');

  /**
   * Replaces the contextual label shown on the status bar.
   * @param label - Short text describing the current screen state.
   */
  setContext(label: string): void {
    this.context.set(label);
  }
}
