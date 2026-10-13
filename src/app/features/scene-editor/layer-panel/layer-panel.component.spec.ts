import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LayerPanelComponent } from './layer-panel.component';
import type { Layer } from '../../../shared/models/scene.model';

function makeLayer(id: string, name: string, visible = true, opacity = 1): Layer {
  return { id, name, visible, opacity, tileData: [[-1]] };
}

describe('LayerPanelComponent', () => {
  let fixture: ComponentFixture<LayerPanelComponent>;

  function setup(
    layers: Layer[],
    activeLayerId: string | null = null,
    collapsed = false,
  ): ComponentFixture<LayerPanelComponent> {
    TestBed.configureTestingModule({ imports: [LayerPanelComponent] });
    fixture = TestBed.createComponent(LayerPanelComponent);
    fixture.componentRef.setInput('layers', layers);
    fixture.componentRef.setInput('activeLayerId', activeLayerId);
    fixture.componentRef.setInput('collapsed', collapsed);
    fixture.detectChanges();
    return fixture;
  }

  function rows(compiled: HTMLElement): NodeListOf<Element> {
    return compiled.querySelectorAll('[tabindex="0"]');
  }

  it('renders layer names in topmost-first display order', () => {
    const compiled = setup([
      makeLayer('l0', 'Ground'),
      makeLayer('l1', 'Props'),
      makeLayer('l2', 'Roof'),
    ]).nativeElement as HTMLElement;

    const names = Array.from(rows(compiled), (row) =>
      row.querySelector('span.tw-truncate')!.textContent!.trim(),
    );
    expect(names).toEqual(['Roof', 'Props', 'Ground']);
  });

  it('highlights the active layer row', () => {
    const compiled = setup([makeLayer('a', 'A'), makeLayer('b', 'B')], 'b')
      .nativeElement as HTMLElement;

    const rendered = rows(compiled);
    expect(rendered[0].classList.contains('tw-bg-accent')).toBe(true);
    expect(rendered[1].classList.contains('tw-bg-accent')).toBe(false);
  });

  it('emits layerSelect with the layer id when a row is clicked', () => {
    const fixtureRef = setup([makeLayer('a', 'A'), makeLayer('b', 'B')]);
    const spy = vi.fn();
    fixtureRef.componentInstance.layerSelect.subscribe(spy);

    rows(fixtureRef.nativeElement as HTMLElement)[1].dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    expect(spy).toHaveBeenCalledWith('a');
  });

  it('emits layerSelect on Enter keydown', () => {
    const fixtureRef = setup([makeLayer('a', 'A'), makeLayer('b', 'B')]);
    const spy = vi.fn();
    fixtureRef.componentInstance.layerSelect.subscribe(spy);

    rows(fixtureRef.nativeElement as HTMLElement)[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );

    expect(spy).toHaveBeenCalledWith('b');
  });

  it('emits layerSelect on Space keydown', () => {
    const fixtureRef = setup([makeLayer('a', 'A'), makeLayer('b', 'B')]);
    const spy = vi.fn();
    fixtureRef.componentInstance.layerSelect.subscribe(spy);

    rows(fixtureRef.nativeElement as HTMLElement)[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
    );

    expect(spy).toHaveBeenCalledWith('b');
  });

  it('emits addLayer with the next default layer name', () => {
    const fixtureRef = setup([makeLayer('a', 'A'), makeLayer('b', 'B')]);
    const spy = vi.fn();
    fixtureRef.componentInstance.addLayer.subscribe(spy);

    const addButton = (fixtureRef.nativeElement as HTMLElement).querySelector(
      'button[title="Add layer"]',
    ) as HTMLButtonElement;
    addButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(spy).toHaveBeenCalledWith('Layer 3');
  });

  it('emits toggleVisibility and stops the row click from selecting the layer', () => {
    const fixtureRef = setup([makeLayer('a', 'A'), makeLayer('b', 'B')]);
    const visibilitySpy = vi.fn();
    const selectSpy = vi.fn();
    fixtureRef.componentInstance.toggleVisibility.subscribe(visibilitySpy);
    fixtureRef.componentInstance.layerSelect.subscribe(selectSpy);

    const row = rows(fixtureRef.nativeElement as HTMLElement)[0];
    row
      .querySelector('button[title="Hide layer"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(visibilitySpy).toHaveBeenCalledWith('b');
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it('switches the visibility icon between visible and hidden states', () => {
    const compiled = setup([makeLayer('a', 'A'), makeLayer('b', 'B', false)])
      .nativeElement as HTMLElement;

    const iconFor = (row: Element): string =>
      row.querySelector('.material-symbols')!.textContent!.trim();
    const rendered = rows(compiled);
    expect(iconFor(rendered[0])).toBe('visibility_off');
    expect(rendered[0].querySelector('button')!.getAttribute('title')).toBe('Show layer');
    expect(iconFor(rendered[1])).toBe('visibility');
    expect(rendered[1].querySelector('button')!.getAttribute('title')).toBe('Hide layer');
  });

  it('shows a muted name for hidden layers', () => {
    const compiled = setup([makeLayer('a', 'A'), makeLayer('b', 'B', false)])
      .nativeElement as HTMLElement;

    const rendered = rows(compiled);
    const nameSpan = rendered[0].querySelector('span.tw-truncate')!;
    expect(nameSpan.classList.contains('tw-text-muted-foreground')).toBe(true);
    expect(
      rendered[1].querySelector('span.tw-truncate')!.classList.contains('tw-text-muted-foreground'),
    ).toBe(false);
  });

  it('emits reorder up and down with the requested directions', () => {
    const fixtureRef = setup([makeLayer('a', 'A'), makeLayer('b', 'B')]);
    const spy = vi.fn();
    fixtureRef.componentInstance.reorder.subscribe(spy);

    const rendered = rows(fixtureRef.nativeElement as HTMLElement);
    rendered[1]
      .querySelector('button[title="Move up"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    rendered[0]
      .querySelector('button[title="Move down"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(spy).toHaveBeenCalledWith({ layerId: 'a', direction: 'up' });
    expect(spy).toHaveBeenCalledWith({ layerId: 'b', direction: 'down' });
  });

  it('disables moving up on the topmost row and down on the bottom-most row', () => {
    const compiled = setup([makeLayer('a', 'A'), makeLayer('b', 'B')]).nativeElement as HTMLElement;

    const rendered = rows(compiled);
    const upButton = (i: number): HTMLButtonElement =>
      rendered[i].querySelector('button[title="Move up"]') as HTMLButtonElement;
    const downButton = (i: number): HTMLButtonElement =>
      rendered[i].querySelector('button[title="Move down"]') as HTMLButtonElement;
    expect(downButton(0).disabled).toBe(false);
    expect(upButton(0).disabled).toBe(true);
    expect(upButton(1).disabled).toBe(false);
    expect(downButton(1).disabled).toBe(true);
  });

  it('emits deleteLayer with the layer id and does not select the row', () => {
    const fixtureRef = setup([makeLayer('a', 'A'), makeLayer('b', 'B')]);
    const deleteSpy = vi.fn();
    const selectSpy = vi.fn();
    fixtureRef.componentInstance.deleteLayer.subscribe(deleteSpy);
    fixtureRef.componentInstance.layerSelect.subscribe(selectSpy);

    const row = rows(fixtureRef.nativeElement as HTMLElement)[1];
    row
      .querySelector('button[title="Delete layer"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(deleteSpy).toHaveBeenCalledWith('a');
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it('disables the delete button when only one layer remains', () => {
    const compiled = setup([makeLayer('a', 'A')]).nativeElement as HTMLElement;

    const deleteButton = compiled.querySelector(
      'button[title="Delete layer"]',
    ) as HTMLButtonElement;
    expect(deleteButton.disabled).toBe(true);
  });

  it('shows the opacity slider and percentage for the active layer only', () => {
    const compiled = setup([makeLayer('a', 'A', true, 0.5), makeLayer('b', 'B')], 'a')
      .nativeElement as HTMLElement;

    const rendered = rows(compiled);
    const activeRange = rendered[1].querySelector('input[type="range"]') as HTMLInputElement;
    expect(activeRange).toBeTruthy();
    expect(activeRange.value).toBe('0.5');
    const percent = rendered[1].querySelector('span.tw-text-right')!.textContent!.trim();
    expect(percent).toBe('50%');
    expect(rendered[0].querySelector('input[type="range"]')).toBeNull();
  });

  it('emits opacityChange when the active layer slider changes', () => {
    const fixtureRef = setup([makeLayer('a', 'A', true, 0.5), makeLayer('b', 'B')], 'a');
    const spy = vi.fn();
    fixtureRef.componentInstance.opacityChange.subscribe(spy);

    const range = rows(fixtureRef.nativeElement as HTMLElement)[1].querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    range.value = '0.75';
    range.dispatchEvent(new Event('input', { bubbles: true }));

    expect(spy).toHaveBeenCalledWith({ layerId: 'a', opacity: 0.75 });
  });

  it('emits toggleCollapsed when the Layers header is clicked', () => {
    const fixtureRef = setup([makeLayer('a', 'A')]);
    const spy = vi.fn();
    fixtureRef.componentInstance.toggleCollapsed.subscribe(spy);

    const header = Array.from(
      (fixtureRef.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((button) => button.textContent?.trim() === 'Layers');
    header!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('hides the layer rows when collapsed', () => {
    const compiled = setup([makeLayer('a', 'A'), makeLayer('b', 'B')], null, true)
      .nativeElement as HTMLElement;

    expect(rows(compiled).length).toBe(0);
  });

  it('prefills the rename input with the current layer name on double-click', () => {
    const fixtureRef = setup([makeLayer('a', 'A'), makeLayer('b', 'B')]);

    const row = rows(fixtureRef.nativeElement as HTMLElement)[1];
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();

    const input = row.querySelector('input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('A');
  });

  it('commits the rename on Enter with a trimmed name', () => {
    const fixtureRef = setup([makeLayer('a', 'A'), makeLayer('b', 'B')]);
    const spy = vi.fn();
    fixtureRef.componentInstance.rename.subscribe(spy);

    const row = rows(fixtureRef.nativeElement as HTMLElement)[1];
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
    const input = row.querySelector('input') as HTMLInputElement;
    input.value = '  NewName  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith({ layerId: 'a', name: 'NewName' });
    expect(row.querySelector('input')).toBeNull();
  });

  it('cancels the rename on Escape without emitting', () => {
    const fixtureRef = setup([makeLayer('a', 'A'), makeLayer('b', 'B')]);
    const spy = vi.fn();
    fixtureRef.componentInstance.rename.subscribe(spy);

    const row = rows(fixtureRef.nativeElement as HTMLElement)[1];
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
    const input = row.querySelector('input') as HTMLInputElement;
    input.value = 'Changed';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(spy).not.toHaveBeenCalled();
    expect(row.querySelector('input')).toBeNull();
  });

  it('does not emit rename when the committed name is blank', () => {
    const fixtureRef = setup([makeLayer('a', 'A'), makeLayer('b', 'B')]);
    const spy = vi.fn();
    fixtureRef.componentInstance.rename.subscribe(spy);

    const row = rows(fixtureRef.nativeElement as HTMLElement)[1];
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
    const input = row.querySelector('input') as HTMLInputElement;
    input.value = '   ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(spy).not.toHaveBeenCalled();
    expect(row.querySelector('input')).toBeNull();
  });
});
