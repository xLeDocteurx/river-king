import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { AppDummyComponent } from './app-dummy.component';

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

  it('should highlight the active nav item in the top bar', async () => {
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

    const active = links.filter((a) => a.classList.contains('tw-text-primary'));
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute('href')).toContain('/project/p1/scenes');
  });
});
