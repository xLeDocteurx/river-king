import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { CdkDropListGroup, CdkDropList, CdkDrag, type CdkDragDrop } from '@angular/cdk/drag-drop';

interface Group<T> {
  key: string;
  items: T[];
  depth: number;
}

/**
 * Displays items grouped by a custom key function with drag-and-drop support.
 * Supports flat or indented (nested-folder) layout via optional depth tracking.
 */
@Component({
  selector: 'rk-grouped-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag],
  templateUrl: './grouped-list.component.html',
  styleUrl: './grouped-list.component.scss',
})
export class GroupedListComponent<T extends { id: string | number; name: string }> {
  /** Items to display, grouped by groupKeyFn. */
  items = input.required<T[]>();
  /** Function that returns the group key (e.g. folderPath) for each item. */
  groupKeyFn = input.required<(item: T) => string>();
  /** Additional group keys to display even when empty (e.g. persisted folders with no items). */
  groupKeys = input<string[]>([]);
  /** Id of the currently selected item. */
  selectedItemId = input<string | number | null>(null);
  /** Title shown in the panel header. */
  title = input.required<string>();
  /** Material Symbol name for item icons. */
  itemIcon = input.required<string>();
  /** Tooltip for the "create group" button. */
  createGroupLabel = input('New Group');
  /** Tooltip for the "create item" button. */
  createItemLabel = input('New Item');
  /**
   * When true, each group header is indented based on the number of slashes
   * in its key, giving a visual hierarchy for nested paths.
   */
  indentGroups = input(false);
  /** Folder / group keys currently collapsed. */
  collapsedGroups = input<string[]>([]);

  /** Emitted when an item is selected. */
  itemSelect = output<string | number>();
  /** Emitted when the user requests deletion of an item. */
  itemDelete = output<string | number>();
  /** Emitted when an item is moved to a different group. */
  groupChange = output<{ itemId: string | number; groupKey: string }>();
  /** Emitted when a group header is toggled. */
  toggleGroup = output<string>();
  /** Emitted when the user requests creation of a new group. */
  createGroup = output<void>();
  /** Emitted when the user requests creation of a new item. */
  createItem = output<void>();

  /** Internal collapsed state, seeded from input. */
  private collapsedSet = computed(() => new Set(this.collapsedGroups()));

  /** Computed grouping of items, including depth for indented mode. */
  groups = computed<Group<T>[]>(() => {
    const map = new Map<string, T[]>();
    // Seed with extra group keys (e.g. empty folders) so they still render.
    for (const key of this.groupKeys()) {
      if (!map.has(key)) {
        map.set(key, []);
      }
    }
    for (const item of this.items()) {
      const key = this.groupKeyFn()(item) || '';
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([key, items]) => ({ key, items, depth: key ? key.split('/').length : 0 }))
      .sort((a, b) => a.key.localeCompare(b.key));
  });

  /**
   * Whether a group is currently collapsed.
   * @param key The group key to check.
   */
  isCollapsed(key: string): boolean {
    return this.collapsedSet().has(key);
  }

  /**
   * Handles a CDK drop event. Emits groupChange when an item is moved between groups.
   * @param event The CDK drag-drop event.
   * @param targetKey The group key of the drop target.
   */
  onDrop(event: CdkDragDrop<T[]>, targetKey: string): void {
    const item = event.item.data as T;
    const itemKey = this.groupKeyFn()(item) || '';
    if (itemKey !== targetKey) {
      this.groupChange.emit({ itemId: item.id, groupKey: targetKey });
    }
  }
}
