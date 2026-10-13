import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DrawingToolsComponent } from './drawing-tools.component';

describe('DrawingToolsComponent', () => {
  let fixture: ComponentFixture<DrawingToolsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DrawingToolsComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DrawingToolsComponent);
  });

  it('should create', () => {
    fixture.componentRef.setInput('tool', 'brush');
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should emit brush tool on brush button click', () => {
    fixture.componentRef.setInput('tool', 'eraser');
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.toolChange.subscribe(spy);

    const brushBtn = fixture.nativeElement.querySelector('[data-testid="tool-brush"]');
    brushBtn.click();
    expect(spy).toHaveBeenCalledWith('brush');
  });

  it('should emit eraser tool on eraser button click', () => {
    fixture.componentRef.setInput('tool', 'brush');
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.toolChange.subscribe(spy);

    const eraserBtn = fixture.nativeElement.querySelector('[data-testid="tool-eraser"]');
    eraserBtn.click();
    expect(spy).toHaveBeenCalledWith('eraser');
  });

  it('should emit fill tool on fill button click', () => {
    fixture.componentRef.setInput('tool', 'brush');
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.toolChange.subscribe(spy);

    const fillBtn = fixture.nativeElement.querySelector('[data-testid="tool-fill"]');
    fillBtn.click();
    expect(spy).toHaveBeenCalledWith('fill');
  });

  it('should highlight the currently selected tool', () => {
    fixture.componentRef.setInput('tool', 'eraser');
    fixture.detectChanges();
    const eraserBtn = fixture.nativeElement.querySelector('[data-testid="tool-eraser"]');
    expect(eraserBtn.classList.contains('tw-bg-primary/10')).toBe(true);
  });

  it('should emit anchor tool on anchor button click', () => {
    fixture.componentRef.setInput('tool', 'brush');
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.toolChange.subscribe(spy);

    const anchorBtn = fixture.nativeElement.querySelector('[data-testid="tool-anchor"]');
    anchorBtn.click();
    expect(spy).toHaveBeenCalledWith('anchor');
  });

  it('should highlight the anchor tool when active', () => {
    fixture.componentRef.setInput('tool', 'anchor');
    fixture.detectChanges();
    const anchorBtn = fixture.nativeElement.querySelector('[data-testid="tool-anchor"]');
    expect(anchorBtn.classList.contains('tw-bg-primary/10')).toBe(true);
  });
});
