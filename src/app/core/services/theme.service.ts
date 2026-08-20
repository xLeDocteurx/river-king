import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'rk-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _document = inject(DOCUMENT);
  private readonly _storage = this._document.defaultView?.localStorage ?? null;

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

  toggle(): void {
    this.theme.update((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  private _readStoredTheme(): Theme {
    const stored = this._storage?.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return 'light';
  }
}
