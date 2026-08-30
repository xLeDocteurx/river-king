import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { AppDummyComponent } from './app-dummy.component';
import { StatusBarService } from './core/services/status-bar.service';
import { SessionService } from './core/services/session.service';
import { UndoService } from './core/services/undo.service';
import 'fake-indexeddb/auto';

describe('App', () => {
  let fixture: ComponentFixture<App>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: 'project/:id/scenes', component: AppDummyComponent },
          { path: 'project/:id/tiles', component: AppDummyComponent },
          { path: 'project/:id/sprites', component: AppDummyComponent },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
  });

  it('should create the app', () => {
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should mark the active nav tab with aria-current', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/project/p1/scenes');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll('nav a'));
    expect(links.length).toBe(3);

    const active = links.filter((a) => a.getAttribute('aria-current') === 'page');
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute('href')).toContain('/project/p1/scenes');
  });

  it('should render an icon-only theme toggle button', async () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector<HTMLButtonElement>('header button[type="button"]');
    expect(toggle).toBeTruthy();
    expect(toggle!.getAttribute('aria-label')).toMatch(/switch to (light|dark) theme/i);
    // Icon-only: the only text content is the Material Symbols ligature name
    expect(toggle!.textContent?.replace(/\s+/g, '')).toMatch(/^(light_mode|dark_mode)$/);
  });

  it('should render the app-wide status bar with context and branding', () => {
    const status = TestBed.inject(StatusBarService);
    status.setContext('3 projects');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const footer = compiled.querySelector('footer');
    expect(footer).toBeTruthy();
    expect(compiled.querySelector('[data-testid="status-context"]')?.textContent?.trim()).toBe(
      '3 projects',
    );
    expect(footer?.textContent).toContain('River King Engine');
  });

  it('records the visited project screen into the session', async () => {
    const sessions = TestBed.inject(SessionService);
    const spy = vi.spyOn(sessions, 'updateSession').mockResolvedValue(undefined);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/project/p1/tiles');

    expect(spy).toHaveBeenCalledWith('p1', { lastScreen: 'tiles' });
  });

  it('clears the undo stack when navigating to a project', async () => {
    const undo = TestBed.inject(UndoService);
    fixture.detectChanges();
    await fixture.whenStable();

    undo.push({
      label: 'Fake action',
      execute: () => undefined,
      undo: () => undefined,
    });
    expect(undo.canUndo()).toBe(true);

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/project/p1/scenes');
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(undo.canUndo()).toBe(false);
  });
});
