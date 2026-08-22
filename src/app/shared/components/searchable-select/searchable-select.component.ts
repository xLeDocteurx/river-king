import { Component, ChangeDetectionStrategy, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Headless searchable dropdown: text input filters options case-insensitively;
 * clicking an option emits it. Escape or selection closes the list.
 * Styling is left to the consumer via the `class` input.
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

  /** Filter text typed by the user. */
  query = signal('');

  /** Whether the option list is visible. */
  open = signal(false);

  /** Options filtered by the current query (case-insensitive substring). */
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const opts = this.options();
    return q ? opts.filter((o) => o.toLowerCase().includes(q)) : opts;
  });

  /**
   * Updates the query from the input event and opens the list.
   * @param event - Input event from the search field.
   */
  onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.open.set(true);
  }

  /**
   * Selects an option, emits it, and closes the list.
   * @param option - Chosen value.
   */
  select(option: string): void {
    this.valueChange.emit(option);
    this.query.set(option);
    this.open.set(false);
  }

  /** Closes the list without changing the value. */
  close(): void {
    this.open.set(false);
  }
}
