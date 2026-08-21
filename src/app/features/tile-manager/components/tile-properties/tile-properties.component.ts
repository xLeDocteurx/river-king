import { Component, input, output, ChangeDetectionStrategy, inject, effect } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { Tile } from '../../../../shared/models/tile.model';

@Component({
  selector: 'rk-tile-properties',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="tw-flex tw-flex-col tw-gap-4 tw-max-w-lg">
      <div class="tw-flex tw-items-center tw-justify-between">
        <h2 class="tw-text-xl tw-font-bold tw-text-foreground">Tile Properties</h2>
        <button
          type="button"
          (click)="delete.emit(tile().id)"
          class="tw-flex tw-items-center tw-gap-1 tw-px-3 tw-py-1.5 tw-rounded-md tw-bg-destructive tw-text-white tw-transition hover:tw-opacity-90"
        >
          <span class="material-symbols" aria-hidden="true">delete</span>
          Delete
        </button>
      </div>

      <label class="tw-flex tw-flex-col tw-gap-1">
        <span class="tw-text-sm tw-font-medium">Name</span>
        <input
          type="text"
          formControlName="name"
          name="name"
          class="tw-px-3 tw-py-2 tw-rounded-md tw-border tw-border-input tw-bg-background tw-text-foreground focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-ring"
        />
      </label>

      <label class="tw-flex tw-flex-col tw-gap-1">
        <span class="tw-text-sm tw-font-medium">Type</span>
        <select
          formControlName="type"
          name="type"
          class="tw-px-3 tw-py-2 tw-rounded-md tw-border tw-border-input tw-bg-background tw-text-foreground focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-ring"
        >
          <option value="static">Static</option>
          <option value="animated">Animated</option>
        </select>
      </label>

      <label class="tw-flex tw-flex-col tw-gap-1">
        <span class="tw-text-sm tw-font-medium">Animation Speed (fps)</span>
        <input
          type="number"
          formControlName="animationSpeed"
          name="animationSpeed"
          class="tw-px-3 tw-py-2 tw-rounded-md tw-border tw-border-input tw-bg-background tw-text-foreground focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-ring"
        />
      </label>

      <div class="tw-flex tw-flex-col tw-gap-2" formGroupName="properties">
        <span class="tw-text-sm tw-font-medium">Properties</span>

        <label class="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
          <input type="checkbox" formControlName="collision" name="collision" class="tw-w-4 tw-h-4" />
          <span>Collision</span>
        </label>

        <label class="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
          <input type="checkbox" formControlName="solid" name="solid" class="tw-w-4 tw-h-4" />
          <span>Solid</span>
        </label>

        <label class="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
          <input type="checkbox" formControlName="interactable" name="interactable" class="tw-w-4 tw-h-4" />
          <span>Interactable</span>
        </label>

        <div class="tw-flex tw-flex-col tw-gap-1">
          <span class="tw-text-sm tw-font-medium">Layer</span>
          <div class="tw-flex tw-gap-4">
            <label class="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
              <input type="radio" formControlName="layer" name="layer" value="background" />
              <span>Background</span>
            </label>
            <label class="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer">
              <input type="radio" formControlName="layer" name="layer" value="foreground" />
              <span>Foreground</span>
            </label>
          </div>
        </div>

        <label class="tw-flex tw-flex-col tw-gap-1">
          <span class="tw-text-sm tw-font-medium">Event Script</span>
          <textarea
            formControlName="eventScript"
            name="eventScript"
            rows="4"
            class="tw-px-3 tw-py-2 tw-rounded-md tw-border tw-border-input tw-bg-background tw-text-foreground focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-ring tw-font-mono tw-text-sm"
            placeholder="Optional JavaScript event script"
          ></textarea>
        </label>
      </div>

      <div class="tw-flex tw-justify-end">
        <button
          type="submit"
          class="tw-px-4 tw-py-2 tw-rounded-md tw-bg-primary tw-text-primary-foreground tw-transition hover:tw-opacity-90"
        >
          Save
        </button>
      </div>
    </form>
  `,
})
export class TilePropertiesComponent {
  tile = input.required<Tile>();
  save = output<Tile>();
  delete = output<number>();

  private readonly fb = inject(FormBuilder);

  form = this.fb.group({
    name: [''],
    type: ['static' as 'static' | 'animated'],
    animationSpeed: [8],
    properties: this.fb.group({
      collision: [false],
      solid: [false],
      interactable: [false],
      layer: ['background' as 'background' | 'foreground'],
      eventScript: [''],
    }),
  });

  constructor() {
    effect(() => {
      const t = this.tile();
      this.form.patchValue({
        name: t.name,
        type: t.type,
        animationSpeed: t.animationSpeed,
        properties: {
          collision: t.properties.collision,
          solid: t.properties.solid,
          interactable: t.properties.interactable,
          layer: t.properties.layer,
          eventScript: t.properties.eventScript ?? '',
        },
      });
    });
  }

  onSubmit() {
    const value = this.form.getRawValue();
    const updated: Tile = {
      ...this.tile(),
      name: value.name ?? '',
      type: value.type ?? 'static',
      animationSpeed: value.animationSpeed != null ? Number(value.animationSpeed) : 8,
      properties: {
        collision: value.properties?.collision ?? false,
        solid: value.properties?.solid ?? false,
        interactable: value.properties?.interactable ?? false,
        layer: (value.properties?.layer as 'background' | 'foreground') ?? 'background',
        eventScript: value.properties?.eventScript || undefined,
      },
    };
    this.save.emit(updated);
  }
}
