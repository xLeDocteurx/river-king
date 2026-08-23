import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

let nextListId = 0;

/**
 * Headless searchable dropdown: text input filters options case-insensitively;
 * clicking an option emits it. Escape or selection closes the list.
 * Exposes the WAI-ARIA combobox pattern (arrow keys move the active option,
 * Enter selects it). Styling is left to the consumer via the `class` input.
 */
@Component({
  selector: 'rk-searchable-select',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './searchable-select.component.html',
  styleUrl: './searchable-select.component.scss',
})
export class SearchableSelectComponent {
  /** All selectable values. */
  options = input.required<string[]>();

  /** Currently selected value, or null. */
  value = input<string | null>(null);

  /** Placeholder shown in the filter input. */
  placeholder = input<string>('Select…');

  /** Consumer styling hook applied to the root container. */
  class = input<string>('');

  /** Emits the chosen option. */
  valueChange = output<string>();

  /** Unique id shared between the combobox input and its listbox (for aria-controls). */
  readonly listId = `rk-searchable-select-listbox-${nextListId++}`;

  /**
   * Filter text typed by the user.
   * Adopts programmatic changes of the `value` input so the displayed
   * text always reflects the current value; local edits persist otherwise.
   */
  query = linkedSignal<string | null, string>({
    source: this.value,
    computation: (value, previous) => (value !== null ? value : (previous?.value ?? '')),
  });

  /** Whether the option list is visible. */
  open = signal(false);

  /** Index of the keyboard-active option within filtered(), or null when none is active. */
  activeIndex = signal<number | null>(null);

  /** Target id for aria-activedescendant based on the active option, or null. */
  readonly activeDescendantId = computed(() =>
    this.activeIndex() === null ? null : `${this.listId}-opt-${this.activeIndex()}`,
  );

  /** Options filtered by the current query (case-insensitive substring). */
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const opts = this.options();
    return q ? opts.filter((o) => o.toLowerCase().includes(q)) : opts;
  });

  /**
   * Updates the query from the input event, resets the active option, and opens the list.
   * @param event - Input event from the search field.
   */
  onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(null);
    this.open.set(true);
  }

  /**
   * Selects an option, emits it, and closes the list.
   * @param option - Chosen value.
   */
  select(option: string): void {
    this.valueChange.emit(option);
    this.query.set(option);
    this.activeIndex.set(null);
    this.open.set(false);
  }

  /** Closes the list without changing the value. */
  close(): void {
    this.open.set(false);
  }

  /**
   * Moves the keyboard-active option down (or opens the list from the first option).
   * Stops at the last entry of the filtered list.
   */
  onArrowDown(): void {
    const count = this.filtered().length;
    if (!count) return;
    const current = this.activeIndex();
    this.activeIndex.set(current === null ? 0 : Math.min(current + 1, count - 1));
  }

  /**
   * Moves the keyboard-active option up.
   * Does nothing when no option is active or the first one already is.
   */
  onArrowUp(): void {
    const current = this.activeIndex();
    if (current === null || current === 0) return;
    this.activeIndex.set(current - 1);
  }

  /**
   * Selects the currently active option.
   * Only acts while the list is open and an option is active.
   */
  onEnter(): void {
    if (!this.open()) return;
    const index = this.activeIndex();
    if (index === null) return;
    const option = this.filtered()[index];
    if (option !== undefined) this.select(option);
  }
}
