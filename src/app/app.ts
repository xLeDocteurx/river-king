import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

@Component({
  imports: [RouterOutlet],
  selector: 'rk-root',
  styleUrl: './app.scss',
  template: `
    <div class="tw-min-h-screen tw-bg-background tw-text-foreground">
      <header
        class="tw-flex tw-items-center tw-justify-between tw-px-6 tw-py-4 tw-border-b tw-border-border"
      >
        <h1 class="tw-text-2xl tw-font-bold tw-tracking-tight">River King</h1>
        <button
          type="button"
          (click)="theme.toggle()"
          class="tw-inline-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-rounded-md tw-bg-primary tw-text-primary-foreground tw-transition hover:tw-opacity-90"
        >
          <span class="material-symbols" aria-hidden="true">
            @if (theme.theme() === 'dark') {
              light_mode
            } @else {
              dark_mode
            }
          </span>
          <span>{{ theme.theme() === 'dark' ? 'Light' : 'Dark' }}</span>
        </button>
      </header>

      <main class="tw-p-6">
        <p class="tw-text-muted-foreground">
          App scaffoldée avec Angular {{ angularVersion }} + Tailwind CSS + Signals + Material
          Symbols.
        </p>
        <router-outlet />
      </main>
    </div>
  `,
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly angularVersion = '22';
}
