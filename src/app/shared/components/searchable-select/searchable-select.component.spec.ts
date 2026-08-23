import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SearchableSelectComponent } from './searchable-select.component';

@Component({
  selector: 'rk-test-host',
  standalone: true,
  imports: [SearchableSelectComponent],
  template:
    '<rk-searchable-select [options]="opts()" [value]="val()" (valueChange)="onValue($event)" />',
})
class TestHostComponent {
  readonly opts = signal<string[]>(['walk', 'talk']);
  readonly val = signal<string | null>(null);
  received: string | null = null;

  onValue(value: string): void {
    this.received = value;
  }
}

describe('SearchableSelectComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function openList(): void {
    const input = fixture.debugElement.query(By.css('input'));
    input.triggerEventHandler('focus', {});
    fixture.detectChanges();
  }

  function optionButtons(): HTMLButtonElement[] {
    return fixture.debugElement
      .queryAll(By.css('button[role="option"]'))
      .map((de) => de.nativeElement as HTMLButtonElement);
  }

  it('renders all options when query is empty', () => {
    openList();
    const buttons = optionButtons();
    expect(buttons).toHaveLength(2);
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['walk', 'talk']);
  });

  it('filters case-insensitively', () => {
    openList();
    const input = fixture.debugElement.query(By.css('input'));
    input.triggerEventHandler('input', { target: { value: 'TA' } });
    fixture.detectChanges();
    const buttons = optionButtons();
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent?.trim()).toBe('talk');
  });

  it('emits valueChange on option click and closes list', () => {
    openList();
    const talkButton = optionButtons().find((b) => b.textContent?.trim() === 'talk');
    talkButton!.click();
    fixture.detectChanges();
    expect(host.received).toBe('talk');
    expect(fixture.debugElement.queryAll(By.css('button[role="option"]'))).toHaveLength(0);
  });

  it('Escape closes the list', () => {
    openList();
    expect(optionButtons()).toHaveLength(2);
    const input = fixture.debugElement.query(By.css('input'));
    input.triggerEventHandler('keydown.escape', {});
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.css('button[role="option"]'))).toHaveLength(0);
  });

  it('shows a no-match entry when nothing matches', () => {
    openList();
    const input = fixture.debugElement.query(By.css('input'));
    input.triggerEventHandler('input', { target: { value: 'zzz' } });
    fixture.detectChanges();
    expect(optionButtons()).toHaveLength(0);
    const listText = fixture.debugElement.query(By.css('ul'))!.nativeElement.textContent;
    expect(listText).toContain('No match');
  });

  it('syncs the displayed text when value is set programmatically', async () => {
    host.val.set('walk');
    fixture.detectChanges();
    // NgModel writes the model to the DOM in a deferred microtask.
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    expect(input.value).toBe('walk');
  });

  it('marks the input as a combobox and exposes the expanded state', () => {
    const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');

    openList();

    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('moves the active option with arrow keys and selects it with Enter', () => {
    openList();
    const inputDebug = fixture.debugElement.query(By.css('input'));

    inputDebug.triggerEventHandler('keydown.arrowdown', {});
    fixture.detectChanges();
    inputDebug.triggerEventHandler('keydown.arrowdown', {});
    fixture.detectChanges();

    const input = inputDebug.nativeElement as HTMLInputElement;
    const buttons = optionButtons();
    expect(input.getAttribute('aria-activedescendant')).toBe(buttons[1].id);

    inputDebug.triggerEventHandler('keydown.enter', {});
    fixture.detectChanges();

    expect(host.received).toBe('talk');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });
});
