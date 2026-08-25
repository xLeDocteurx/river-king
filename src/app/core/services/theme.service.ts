import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

/** Available application themes. */
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'rk-theme';

/**
 * Controls the application's visual theme (light / dark).
 *
 * Persists the selection to `localStorage` and syncs the `dark` class
 * and `data-theme` attribute on `<html>` so Tailwind's `darkMode: 'class'`
 * and the SCSS token layers stay in sync.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _document = inject(DOCUMENT);
  private readonly _storage = this._document.defaultView?.localStorage ?? null;

  /** Current active theme. Writing to this signal applies the theme immediately. */
  readonly theme = signal<Theme>(this._readStoredTheme());

  constructor() {
    effect(() => {
      const t = this.theme();
      const html = this._document.documentElement;
      if (t === 'dark') {
        html.classList.add('dark');
        html.setAttribute('data-theme', 'dark');
      } else {
        html.classList.remove('dark');
        html.setAttribute('data-theme', 'light');
      }
      this._storage?.setItem(STORAGE_KEY, t);
    });
  }

  /**
   * Switch between light and dark themes.
   */
  toggle(): void {
    this.theme.update((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  /**
   * Read the persisted theme from `localStorage`, defaulting to `'light'`.
   *
   * @returns The stored theme or `'light'` if none is stored or the value is invalid.
   */
  private _readStoredTheme(): Theme {
    const stored = this._storage?.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return 'light';
  }
}
