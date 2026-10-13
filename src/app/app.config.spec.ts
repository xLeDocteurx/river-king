import { TestBed } from '@angular/core/testing';
import { provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { initializeDemoSeed } from './app.config';
import { DemoProjectService, DEMO_SEED_MARKER } from './core/services/demo-project.service';
import 'fake-indexeddb/auto';

describe('app bootstrap', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('awaits the demo seed before the app renders', async () => {
    const seedSpy = vi.spyOn(DemoProjectService.prototype, 'ensureDemo').mockResolvedValue(false);

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideAppInitializer(initializeDemoSeed)],
    }).compileComponents();

    TestBed.createComponent(App);

    expect(seedSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(DEMO_SEED_MARKER)).toBeNull();
  });
});
