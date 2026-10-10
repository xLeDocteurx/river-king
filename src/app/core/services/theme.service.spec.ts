import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

const STORAGE_KEY = 'rk-theme';

describe('ThemeService', () => {
  let service: ThemeService;
  let html: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    html = document.documentElement;
    html.classList.remove('dark');
    html.removeAttribute('data-theme');
    TestBed.configureTestingModule({});
  });

  function createService(): ThemeService {
    service = TestBed.inject(ThemeService);
    return service;
  }

  async function flushEffects(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
  }

  it('should be created', () => {
    createService();
    expect(service).toBeTruthy();
  });

  it('is provided as a root singleton', () => {
    createService();
    expect(TestBed.inject(ThemeService)).toBe(service);
  });

  it('defaults to the light theme and syncs the document', async () => {
    createService();
    expect(service.theme()).toBe('light');

    await flushEffects();

    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
    expect(html.classList.contains('dark')).toBe(false);
    expect(html.getAttribute('data-theme')).toBe('light');
  });

  it('toggles to dark and syncs the signal, storage and document', async () => {
    createService();
    service.toggle();

    expect(service.theme()).toBe('dark');
    await flushEffects();

    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(html.classList.contains('dark')).toBe(true);
    expect(html.getAttribute('data-theme')).toBe('dark');
  });

  it('toggles back from dark to light', async () => {
    createService();
    service.toggle();
    service.toggle();

    expect(service.theme()).toBe('light');
    await flushEffects();

    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
    expect(html.classList.contains('dark')).toBe(false);
    expect(html.getAttribute('data-theme')).toBe('light');
  });

  it('restores a persisted theme from localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    createService();

    expect(service.theme()).toBe('dark');
    await flushEffects();

    expect(html.classList.contains('dark')).toBe(true);
    expect(html.getAttribute('data-theme')).toBe('dark');
  });

  it('falls back to light when the stored value is invalid', () => {
    localStorage.setItem(STORAGE_KEY, 'midnight');
    createService();

    expect(service.theme()).toBe('light');
  });
});
