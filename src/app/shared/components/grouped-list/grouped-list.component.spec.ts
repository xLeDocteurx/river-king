import { type DebugElement } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { GroupedListComponent } from './grouped-list.component';

interface TestItem {
  id: string;
  name: string;
  folder: string;
}

describe('GroupedListComponent', () => {
  let fixture: ComponentFixture<GroupedListComponent<TestItem>>;
  let component: GroupedListComponent<TestItem>;

  function render(items: TestItem[], extraInputs: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(GroupedListComponent<TestItem>);
    const ref = fixture.componentRef;
    ref.setInput('groupKeyFn', (item: TestItem) => item.folder);
    ref.setInput('title', 'Sprites');
    ref.setInput('itemIcon', 'image');
    ref.setInput('items', items);
    for (const [key, value] of Object.entries(extraInputs)) {
      ref.setInput(key, value);
    }
    fixture.detectChanges();
    component = fixture.componentInstance;
  }

  function buttonsByTitle(title: string): DebugElement[] {
    return fixture.debugElement
      .queryAll(By.css('button'))
      .filter((b) => b.nativeElement.getAttribute('title') === title);
  }

  function buttonContaining(text: string): DebugElement {
    const found = fixture.debugElement
      .queryAll(By.css('button'))
      .find((b) => (b.nativeElement.textContent ?? '').includes(text));
    if (!found) {
      throw new Error(`No button containing "${text}"`);
    }
    return found;
  }

  function groupHeaderButton(key: string): DebugElement {
    const found = fixture.debugElement.queryAll(By.css('button')).find((b) => {
      const text = b.nativeElement.textContent ?? '';
      return text.includes('expand_more') && text.includes(key);
    });
    if (!found) {
      throw new Error(`No group header button for "${key}"`);
    }
    return found;
  }

  interface FakeDataTransfer {
    effectAllowed: string;
    dropEffect: string;
    setData: ReturnType<typeof vi.fn>;
  }

  function makeDragEvent(): { event: DragEvent; dataTransfer: FakeDataTransfer } {
    const dataTransfer: FakeDataTransfer = { effectAllowed: '', dropEffect: '', setData: vi.fn() };
    const event = {
      preventDefault: vi.fn(),
      dataTransfer,
    } as unknown as DragEvent;
    return { event, dataTransfer };
  }

  function makeDropEvent(item: TestItem): CdkDragDrop<TestItem[]> {
    return { item: { data: item } } as unknown as CdkDragDrop<TestItem[]>;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupedListComponent],
    }).compileComponents();
  });

  it('groups items by folder, sorting groups and items by name', () => {
    render([
      { id: '2', name: 'zulu', folder: 'B' },
      { id: '1', name: 'alpha', folder: 'B' },
      { id: '3', name: 'beta', folder: 'A' },
    ]);

    expect(component.groups().map((g) => g.key)).toEqual(['A', 'B']);
    expect(component.groups()[0].items.map((i) => i.name)).toEqual(['beta']);
    expect(component.groups()[1].items.map((i) => i.name)).toEqual(['alpha', 'zulu']);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text.indexOf('A')).toBeLessThan(text.indexOf('B'));
  });

  it('seeds empty groups from groupKeys and labels an empty key as Ungrouped', () => {
    render([{ id: '1', name: 'lonely', folder: '' }], { groupKeys: ['Empty'] });

    expect(component.groups().map((g) => g.key)).toEqual(['', 'Empty']);
    expect(buttonsByTitle('Delete folder Empty')).toHaveLength(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ungrouped');
  });

  it('shows the empty state when there are no groups', () => {
    render([]);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No sprites yet');
  });

  it('shows a drop hint inside an empty group', () => {
    render([], { groupKeys: ['Loose'] });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Drop sprites here');
  });

  it('emits itemSelect with the item id when an item is clicked', () => {
    render([{ id: '7', name: 'knight', folder: 'Units' }]);
    const received: (string | number)[] = [];
    component.itemSelect.subscribe((id) => received.push(id));

    buttonContaining('knight').triggerEventHandler('click', {});

    expect(received).toEqual(['7']);
  });

  it('emits itemDelete with the item id from the delete button', () => {
    render([{ id: '9', name: 'knight', folder: 'Units' }]);
    const received: (string | number)[] = [];
    component.itemDelete.subscribe((id) => received.push(id));
    const event = { stopPropagation: vi.fn() };

    buttonsByTitle('Delete Sprites')[0].triggerEventHandler('click', event);

    expect(received).toEqual(['9']);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('emits toggleGroup when a group header is clicked', () => {
    render([{ id: '1', name: 'knight', folder: 'Units' }], { collapsedGroups: [] });
    const received: string[] = [];
    component.toggleGroup.subscribe((key) => received.push(key));

    groupHeaderButton('Units').triggerEventHandler('click', {});

    expect(received).toEqual(['Units']);
  });

  it('hides the items of collapsed groups and rotates the chevron', () => {
    render([{ id: '1', name: 'hidden', folder: 'Units' }], { collapsedGroups: ['Units'] });

    expect(component.isCollapsed('Units')).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('hidden');
    const chevron = fixture.debugElement
      .queryAll(By.css('.material-symbols'))
      .find((s) => (s.nativeElement.textContent ?? '').trim() === 'expand_more');
    expect(chevron?.nativeElement.classList).toContain('-tw-rotate-90');
  });

  it('marks the selected item', () => {
    render([{ id: '1', name: 'knight', folder: 'Units' }], { selectedItemId: '1' });

    expect(buttonContaining('knight').nativeElement.classList).toContain('tw-bg-primary/10');
  });

  it('indents group headers by slash depth when indentGroups is enabled', () => {
    render([{ id: '1', name: 'knight', folder: 'a/b/c' }], { indentGroups: true });

    expect(component.groups()[0].depth).toBe(3);
    const wrapper = fixture.debugElement.query(By.css('[draggable="true"]')).parent!;
    expect((wrapper.nativeElement as HTMLElement).style.paddingLeft).toBe('48px');
  });

  it('emits createItem from the add button', () => {
    render([]);
    const emitted = vi.fn();
    component.createItem.subscribe(emitted);

    buttonsByTitle('New Item')[0].triggerEventHandler('click', {});

    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('creates a folder from the inline input and emits createGroup', () => {
    render([]);
    const received: string[] = [];
    component.createGroup.subscribe((name) => received.push(name));

    buttonsByTitle('New Group')[0].triggerEventHandler('click', {});
    fixture.detectChanges();
    expect(component.addingGroup()).toBe(true);

    const input = (fixture.nativeElement as HTMLElement).querySelector(
      'input[placeholder="New folder name"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = 'Weapons';
    input.dispatchEvent(new InputEvent('input'));
    fixture.detectChanges();

    component.commitGroupCreate();

    expect(received).toEqual(['Weapons']);
    expect(component.addingGroup()).toBe(false);
  });

  it('cancels folder creation on Escape without emitting', () => {
    render([]);
    const emitted = vi.fn();
    component.createGroup.subscribe(emitted);
    component.startGroupCreate();
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector(
      'input[placeholder="New folder name"]',
    ) as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(component.addingGroup()).toBe(false);
    expect(emitted).not.toHaveBeenCalled();
  });

  it('ignores empty and duplicate folder names', () => {
    render([{ id: '1', name: 'knight', folder: 'Units' }]);
    const emitted = vi.fn();
    component.createGroup.subscribe(emitted);

    component.startGroupCreate();
    component.commitGroupCreate();
    expect(emitted).not.toHaveBeenCalled();

    component.startGroupCreate();
    component.newGroupName.set('Units');
    component.commitGroupCreate();
    expect(emitted).not.toHaveBeenCalled();
  });

  it('emits groupDelete for an empty folder and stops the click from propagating', () => {
    render([], { groupKeys: ['Units'] });
    const received: string[] = [];
    component.groupDelete.subscribe((key) => received.push(key));
    const event = { stopPropagation: vi.fn(), preventDefault: vi.fn() };

    buttonsByTitle('Delete folder Units')[0].triggerEventHandler('click', event);

    expect(received).toEqual(['Units']);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('enters inline rename on double-click and emits groupRename on commit', () => {
    render([{ id: '1', name: 'knight', folder: 'Units' }]);
    const received: { fromKey: string; toKey: string }[] = [];
    component.groupRename.subscribe((rename) => received.push(rename));

    fixture.debugElement.query(By.css('[draggable="true"]')).triggerEventHandler('dblclick', {});
    fixture.detectChanges();
    expect(component.renamingKey()).toBe('Units');

    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    input.value = 'Characters';
    input.dispatchEvent(new InputEvent('input'));
    fixture.detectChanges();

    component.commitGroupRename();

    expect(received).toEqual([{ fromKey: 'Units', toKey: 'Characters' }]);
    expect(component.renamingKey()).toBeNull();
  });

  it('does not emit groupRename when the name is unchanged or blank', () => {
    render([{ id: '1', name: 'knight', folder: 'Units' }]);
    const emitted = vi.fn();
    component.groupRename.subscribe(emitted);

    component.startGroupRename('Units');
    component.commitGroupRename();
    expect(emitted).not.toHaveBeenCalled();

    component.startGroupRename('Units');
    component.renameValue.set('   ');
    component.commitGroupRename();
    expect(emitted).not.toHaveBeenCalled();
  });

  it('emits groupChange when an item is dropped into another group', () => {
    render([{ id: '1', name: 'knight', folder: 'A' }]);
    const received: { itemId: string | number; groupKey: string }[] = [];
    component.groupChange.subscribe((change) => received.push(change));

    component.onDrop(makeDropEvent({ id: '1', name: 'knight', folder: 'A' }), 'B');

    expect(received).toEqual([{ itemId: '1', groupKey: 'B' }]);
  });

  it('does not emit groupChange when an item is dropped in its own group', () => {
    render([{ id: '1', name: 'knight', folder: 'A' }]);
    const emitted = vi.fn();
    component.groupChange.subscribe(emitted);

    component.onDrop(makeDropEvent({ id: '1', name: 'knight', folder: 'A' }), 'A');

    expect(emitted).not.toHaveBeenCalled();
  });

  it('emits groupMove when a folder is dropped onto another folder', () => {
    render([
      { id: '1', name: 'knight', folder: 'A' },
      { id: '2', name: 'mage', folder: 'B' },
    ]);
    const received: { fromKey: string; toKey: string }[] = [];
    component.groupMove.subscribe((move) => received.push(move));
    const { event, dataTransfer } = makeDragEvent();

    component.onGroupDragStart('A', event);
    expect(dataTransfer.effectAllowed).toBe('move');
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'A');

    component.onGroupDragOver('B', event);
    expect(dataTransfer.dropEffect).toBe('move');
    expect(component.isGroupDropTarget('B')).toBe(true);

    component.onGroupDrop('B');

    expect(received).toEqual([{ fromKey: 'A', toKey: 'B' }]);
    expect(component.isGroupDropTarget('B')).toBe(false);
  });

  it('ignores a folder drop onto itself', () => {
    render([{ id: '1', name: 'knight', folder: 'A' }]);
    const emitted = vi.fn();
    component.groupMove.subscribe(emitted);
    const { event } = makeDragEvent();

    component.onGroupDragStart('A', event);
    component.onGroupDragOver('A', event);
    component.onGroupDrop('A');

    expect(emitted).not.toHaveBeenCalled();
  });

  it('does not start a folder drag while renaming', () => {
    render([{ id: '1', name: 'knight', folder: 'A' }]);
    const emitted = vi.fn();
    component.groupMove.subscribe(emitted);
    component.startGroupRename('A');
    const { event } = makeDragEvent();

    component.onGroupDragStart('A', event);
    component.onGroupDragOver('B', event);
    component.onGroupDrop('B');

    expect(emitted).not.toHaveBeenCalled();
  });
});
