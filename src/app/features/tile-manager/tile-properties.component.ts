import {
  Component,
  ChangeDetectionStrategy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SearchableSelectComponent } from '../../shared/components/searchable-select/searchable-select.component';
import { NotificationService } from '../../core/services/notification.service';
import { listGameActions } from '../../core/actions/game-actions';
import type { ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import type { Tile } from '../../shared/models/tile.model';
import { TileService } from './services/tile.service';
import { TileSpritesService } from './services/tile-sprites.service';

/**
 * Tile properties form component.
 *
 * Displays a reactive form for editing a tile's name, type, animation speed,
 * linked sprite thumbnails (with animated-frame lifecycle), tile-unit size
 * applied to all frames, and blocking/interactable properties (action chosen
 * through a searchable dropdown). Persists frame lifecycle and size changes
 * through {@link TileSpritesService} shared state; navigation to the sprite
 * editor is performed directly via the Router. Only save/delete user
 * submissions are delegated upward. Stored tile values are synced into the
 * form only when the edited tile identity changes, so sprite-array mutations
 * (frame create/delete/resize) never discard unsaved edits.
 */
@Component({
  selector: 'rk-tile-properties',
  standalone: true,
  imports: [ReactiveFormsModule, SearchableSelectComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tile-properties.component.html',
  styleUrl: './tile-properties.component.scss',
})
export class TilePropertiesComponent {
  /** The tile to edit. */
  tile = input<Tile>();

  /** Project tile size in pixels; converts tile units to pixels. */
  projectTileSize = input<number>();

  /** Project palette used when re-encoding resized frames. */
  projectPalette = input<string[]>();

  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly tileService = inject(TileService);
  private readonly spriteService = inject(TileSpritesService);
  private readonly notification = inject(NotificationService);

  /** Reactive list of the edited tile's frames (shared feature state). */
  readonly tileSprites = this.spriteService.sprites;

  /** Emitted when the form is submitted with valid data. */
  save = output<Tile>();

  /** Emitted when the delete button is clicked. */
  delete = output<number>();

  /** Reference to the dialog confirming frame deletions. */
  private readonly framesDialog = viewChild.required<ConfirmDialogComponent>('framesDialog');

  /** Reference to the dialog warning about size cropping. */
  private readonly sizeDialog = viewChild.required<ConfirmDialogComponent>('sizeDialog');

  /** Reactive form backing name/type/speed/blocking inputs. */
  form = this.fb.group({
    name: [''],
    type: ['static' as 'static' | 'animated'],
    animationSpeed: [8],
    properties: this.fb.group({
      blocking: [false],
    }),
  });

  /** Currently selected tile type (mirrors the select for conditional UI). */
  typeSelected = signal<'static' | 'animated'>('static');

  /** Target frame count shown in the Frames input. */
  frameCount = signal(1);

  /** Width of the tile in tile units. */
  widthTiles = signal(1);

  /** Height of the tile in tile units. */
  heightTiles = signal(1);

  /** Selected action id from the searchable dropdown (null when none). */
  actionId = signal<string | null>(null);

  /** Whether the Interactable checkbox is checked. */
  interactableChecked = signal(false);

  /** Target frame count awaiting deletion confirmation (null = none). */
  pendingFrameReduction = signal<number | null>(null);

  /** Pending shrink dimensions awaiting crop confirmation (null = none). */
  pendingSizeShrink = signal<{ w: number; h: number } | null>(null);

  /** Static configuration for the frame-deletion confirmation dialog. */
  readonly framesDialogData: ConfirmDialogData = {
    title: 'Delete Frames',
    message: 'This will permanently delete the extra frames. This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  };

  /** Static configuration for the size-crop confirmation dialog. */
  readonly sizeDialogData: ConfirmDialogData = {
    title: 'Crop Content',
    message:
      'Reducing the size will crop content that does not fit. This may cause permanent loss of drawn pixels.',
    confirmLabel: 'Crop',
    cancelLabel: 'Cancel',
  };

  /** All registered game-action keys offered in the dropdown. */
  readonly knownActions = listGameActions();

  /** Hint shown when the stored actionId is not in the registry. */
  unknownActionHint = computed(() => {
    const id = this.actionId();
    if (!id || !this.interactableChecked()) return null;
    return this.knownActions.includes(id) ? null : '(action inconnue)';
  });

  /** Current width/height of the first linked sprite expressed in tile units. */
  currentTiles = computed(() => {
    const s = this.tileSprites()[0];
    const ts = (this.projectTileSize() ?? 1) || 1;
    return {
      w: s ? Math.max(1, Math.round(s.width / ts)) : 1,
      h: s ? Math.max(1, Math.round(s.height / ts)) : 1,
    };
  });

  /** Id of the tile whose stored values were last patched into the form. */
  private lastPatchedTileId: number | null = null;

  constructor() {
    // Sync local state only when the edited tile identity changes; replacing
    // the sprites array for the same tile must not clobber unsaved edits.
    effect(() => {
      const t = this.tile();
      if (!t) {
        this.lastPatchedTileId = null;
        return;
      }
      if (t.id === this.lastPatchedTileId) return;
      this.lastPatchedTileId = t.id;
      const sprites = this.tileSprites();
      this.form.patchValue({
        name: t.name,
        type: t.type,
        animationSpeed: t.animationSpeed,
        properties: { blocking: t.properties.blocking },
      });
      this.typeSelected.set(t.type);
      this.frameCount.set(Math.max(1, t.spriteIds.length || (sprites?.length ?? 0) || 1));
      this.widthTiles.set(this.currentTiles().w);
      this.heightTiles.set(this.currentTiles().h);
      this.actionId.set(t.properties.actionId ?? null);
      this.interactableChecked.set(t.properties.interactable);
    });

    // Open the frames-deletion dialog when a reduction is pending.
    effect(() => {
      if (this.pendingFrameReduction() !== null) {
        this.framesDialog().open();
      }
    });

    // Open the crop-warning dialog when a shrink is pending.
    effect(() => {
      if (this.pendingSizeShrink() !== null) {
        this.sizeDialog().open();
      }
    });
  }

  /**
   * Handles a tile-type switch and its frame consequences:
   * static→animated ensures at least one frame exists;
   * animated→static keeps frame 1 and asks to delete the rest.
   * @param type - Newly selected tile type.
   */
  async onTypeChange(type: string): Promise<void> {
    const value = type as 'static' | 'animated';
    this.typeSelected.set(value);
    if (value === 'animated') {
      const sprites = this.tileSprites();
      if (sprites.length === 0) {
        try {
          await this.createFramesFrom(0, 1);
          await this.spriteService.markMutated();
          this.notification.success('Frame created');
        } catch {
          this.notification.error('Failed to create frame');
        }
      }
    } else if (this.tileSprites().length > 1) {
      this.pendingFrameReduction.set(1);
    }
  }

  /**
   * Applies a new target frame count: growing creates blank frames silently;
   * shrinking opens the deletion confirmation.
   * @param target - Requested frame count (minimum 1).
   */
  async onFrameCountInput(target: number): Promise<void> {
    const clamped = Math.max(1, Number.isFinite(target) ? Math.floor(target) : 1);
    const current = this.tileSprites().length;
    if (clamped === current) return;
    if (clamped < current) {
      this.pendingFrameReduction.set(clamped);
      return;
    }
    try {
      await this.createFramesFrom(current, clamped);
      await this.spriteService.markMutated();
      this.notification.success('Frames created');
    } catch {
      this.notification.error('Failed to create frames');
    }
  }

  /**
   * Confirms the pending frame reduction: deletes extra sprites,
   * updates the tile's spriteIds, notifies the parent, and closes the dialog.
   */
  async confirmFrameReduction(): Promise<void> {
    const t = this.tile()!;
    const target = this.pendingFrameReduction();
    if (target === null) return;
    const sprites = this.tileSprites();
    const keep = sprites.slice(0, target);
    const extras = sprites.slice(target);
    try {
      await this.spriteService.deleteSprites(extras.map((s) => s.id));
      await this.tileService.updateTile(t.id, {
        spriteIds: keep.map((s) => s.id),
      });
      await this.spriteService.markMutated();
      this.notification.success('Frames deleted');
    } catch {
      this.notification.error('Failed to delete frames');
    } finally {
      this.pendingFrameReduction.set(null);
    }
  }

  /** Cancels the pending frame reduction and closes the dialog. */
  cancelFrameReduction(): void {
    this.pendingFrameReduction.set(null);
  }

  /**
   * Evaluates the requested size against current frame dimensions:
   * any reduction opens the crop warning; pure growth applies immediately.
   */
  async requestSizeApply(): Promise<void> {
    const cur = this.currentTiles();
    const w = Math.max(1, Math.floor(this.widthTiles()));
    const h = Math.max(1, Math.floor(this.heightTiles()));
    if (w < cur.w || h < cur.h) {
      this.pendingSizeShrink.set({ w, h });
      return;
    }
    await this.applySize();
  }

  /**
   * Resizes every linked frame to the requested tile-unit dimensions
   * (crop/pad anchored top-left), then notifies the parent.
   * When invoked from the crop confirmation, uses the dimensions that were
   * confirmed (pendingSizeShrink) rather than possibly-edited live inputs.
   */
  async applySize(): Promise<void> {
    const pending = this.pendingSizeShrink();
    const w = Math.max(1, Math.floor(pending?.w ?? this.widthTiles()));
    const h = Math.max(1, Math.floor(pending?.h ?? this.heightTiles()));
    const ts = this.projectTileSize() ?? 1;
    const palette = this.projectPalette() ?? [];
    try {
      await this.spriteService.resizeSprites(this.tileSprites(), w * ts, h * ts, palette);
      await this.spriteService.markMutated();
      this.notification.success('Frames resized');
    } catch {
      this.notification.error('Failed to resize frames');
    } finally {
      this.pendingSizeShrink.set(null);
    }
  }

  /** Cancels the pending size shrink and closes the dialog. */
  cancelSizeApply(): void {
    this.pendingSizeShrink.set(null);
  }

  /**
   * Navigates to the sprite editor in focus mode for the clicked thumbnail.
   * @param spriteId - Id of the sprite behind the thumbnail.
   */
  openSprite(spriteId: number): void {
    const t = this.tile();
    if (!t) return;
    void this.router.navigate(['/project', t.projectId, 'sprites', spriteId]);
  }

  /**
   * Builds an updated {@link Tile} from the form values plus local signals
   * and emits it via `save`. actionId is kept only when interactable is checked.
   */
  onSubmit(): void {
    const base = this.tile()!;
    const value = this.form.getRawValue();
    const updated: Tile = {
      ...base,
      name: value.name ?? '',
      type: value.type ?? 'static',
      animationSpeed: value.animationSpeed != null ? Number(value.animationSpeed) : 8,
      properties: {
        blocking: value.properties?.blocking ?? false,
        interactable: this.interactableChecked(),
        actionId: this.interactableChecked() ? (this.actionId() ?? undefined) : undefined,
      },
    };
    this.save.emit(updated);
  }

  /**
   * Creates blank frames appended after the existing ones and syncs spriteIds.
   * @param from - Current frame count.
   * @param to - Target frame count.
   */
  private async createFramesFrom(from: number, to: number): Promise<void> {
    const t = this.tile()!;
    const ts = this.projectTileSize() ?? 16;
    const ids: number[] = [];
    for (let i = from; i < to; i++) {
      const sprite = await this.spriteService.createBlankFrame(
        t.projectId,
        t.id,
        `frame ${i + 1}`,
        ts,
        ts,
      );
      ids.push(sprite.id);
    }
    await this.tileService.updateTile(t.id, {
      spriteIds: [...t.spriteIds, ...ids],
    });
  }
}
