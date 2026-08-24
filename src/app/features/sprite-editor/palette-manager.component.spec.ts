import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PaletteManagerComponent } from './palette-manager.component';

describe('PaletteManagerComponent', () => {
  let fixture: ComponentFixture<PaletteManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaletteManagerComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(PaletteManagerComponent);
  });

  it('should create', () => {
    fixture.componentRef.setInput('palette', ['#ff0000', '#00ff00']);
    fixture.componentRef.setInput('selectedIndex', 0);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render palette colors', () => {
    fixture.componentRef.setInput('palette', ['#ff0000', '#00ff00', '#0000ff']);
    fixture.componentRef.setInput('selectedIndex', 0);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(3);
    expect(buttons[0].style.backgroundColor).toBe('rgb(255, 0, 0)');
    expect(buttons[1].style.backgroundColor).toBe('rgb(0, 255, 0)');
  });

  it('should emit selected index on color click', () => {
    fixture.componentRef.setInput('palette', ['#ff0000', '#00ff00']);
    fixture.componentRef.setInput('selectedIndex', 0);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.selectedIndexChange.subscribe(spy);

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[1].click();
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('should highlight selected index', () => {
    fixture.componentRef.setInput('palette', ['#ff0000', '#00ff00']);
    fixture.componentRef.setInput('selectedIndex', 1);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[1].classList.contains('tw-ring-2')).toBe(true);
    expect(buttons[0].classList.contains('tw-ring-2')).toBe(false);
  });

  it('lays the swatches out in a four-column grid', () => {
    const colors = Array.from({ length: 16 }, (_, i) => `#${i.toString(16).padStart(2, '0')}0000`);
    fixture.componentRef.setInput('palette', colors);
    fixture.componentRef.setInput('selectedIndex', 0);
    fixture.detectChanges();
    const grid = fixture.nativeElement.querySelector('[data-testid=palette-grid]');
    expect(grid.className).toContain('tw-grid-cols-4');
  });
});
