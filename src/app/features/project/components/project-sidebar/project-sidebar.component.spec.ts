import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProjectSidebarComponent } from './project-sidebar.component';

@Component({
  standalone: true,
  template: `<rk-project-sidebar projectId="test-project" />`,
  imports: [ProjectSidebarComponent],
})
class TestHostComponent {}

describe('ProjectSidebarComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should render 3 navigation links (Scenes, Tiles, Sprites)', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const links =
      fixture.nativeElement.querySelectorAll('nav > a');
    expect(links.length).toBe(3);
    expect(links[0].textContent.trim()).toContain('Scenes');
    expect(links[1].textContent.trim()).toContain('Tiles');
    expect(links[2].textContent.trim()).toContain('Sprites');
  });

  it('should have correct routerLink paths', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('nav > a');
    expect(links[0].getAttribute('href')).toBe('/scenes');
    expect(links[1].getAttribute('href')).toBe('/tiles');
    expect(links[2].getAttribute('href')).toBe('/sprites');
  });

  it('should use Material Symbols icons', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const icons = fixture.nativeElement.querySelectorAll('.material-symbols');
    // Workspace icon + 3 nav icons = 4 total
    expect(icons.length).toBe(4);
  });
});
