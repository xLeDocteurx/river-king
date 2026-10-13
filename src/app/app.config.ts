import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { DemoProjectService } from './core/services/demo-project.service';

/**
 * Bootstrap initializer that seeds the demo project before the first render,
 * so the dashboard's one-shot project load always observes the demo data.
 * @returns Promise resolved once seeding has been attempted.
 */
export function initializeDemoSeed(): Promise<boolean> {
  return inject(DemoProjectService).ensureDemo();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAppInitializer(initializeDemoSeed),
  ],
};
