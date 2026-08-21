import { Component, input, output, ChangeDetectionStrategy, inject, effect } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { Tile } from '../../shared/models/tile.model';

/**
 * Tile properties form component.
 *
 * Displays a reactive form for editing a tile's name, type,
 * animation speed, and boolean / enum properties. Emits
 * save and delete events to the parent.
 */
@Component({
  selector: 'rk-tile-properties',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tile-properties.component.html',
  styleUrl: './tile-properties.component.scss',
})
export class TilePropertiesComponent {
  /** The tile to edit. */
  tile = input.required<Tile>();

  /** Emitted when the form is submitted with valid data. */
  save = output<Tile>();

  /** Emitted when the delete button is clicked. */
  delete = output<number>();

  private readonly fb = inject(FormBuilder);

  /** Reactive form backing the tile property inputs. */
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

  /**
   * Builds an updated {@link Tile} from the form values and emits it via `save`.
   */
  onSubmit(): void {
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
