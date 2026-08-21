import {
  Component,
  DestroyRef,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
  computed,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SpriteService } from '../../services/sprite.service';
import { PixelCanvasComponent } from '../../components/pixel-canvas/pixel-canvas.component';
import { PaletteManagerComponent } from '../../components/palette-manager/palette-manager.component';
import { DrawingToolsComponent, type DrawingTool } from '../../components/drawing-tools/drawing-tools.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DatabaseService } from '../../../../core/services/database.service';
import type { Sprite } from '../../../../shared/models/sprite.model';

@Component({
  selector: 'rk-sprite-editor',
  standalone: true,
  providers: [SpriteService],
  imports: [PixelCanvasComponent, PaletteManagerComponent, DrawingToolsComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-flex tw-h-full">
      <!-- Left: Sprite List -->
      <div class="tw-w-64 tw-shrink-0 tw-border-r tw-border-border tw-bg-card tw-flex tw-flex-col">
        <div class="tw-flex tw-items-center tw-justify-between tw-px-4 tw-py-3 tw-border-b tw-border-border">
          <h3 class="tw-font-semibold tw-text-foreground">Sprites</h3>
          <button
            type="button"
            (click)="createSprite()"
            class="tw-p-1 tw-rounded-md hover:tw-bg-muted"
            title="New Sprite"
          >
            <span class="material-symbols" aria-hidden="true">add</span>
          </button>
        </div>
        <div class="tw-flex-1 tw-overflow-auto tw-p-2">
          @for (sprite of sprites(); track sprite.id) {
            <button
              type="button"
              (click)="selectSprite(sprite.id)"
              [class.tw-bg-primary/10]="selectedSpriteId() === sprite.id"
              class="tw-w-full tw-text-left tw-px-3 tw-py-2 tw-rounded-md tw-text-sm tw-text-foreground hover:tw-bg-muted tw-transition tw-flex tw-items-center tw-gap-2"
            >
              <span class="material-symbols tw-text-muted-foreground" aria-hidden="true">image</span>
              <span>{{ sprite.name }}</span>
            </button>
          } @empty {
            <div class="tw-text-muted-foreground tw-text-sm tw-text-center tw-py-4">No sprites yet</div>
          }
        </div>
      </div>

      <!-- Center: Canvas -->
      <div class="tw-flex-1 tw-flex tw-items-center tw-justify-center tw-bg-background tw-p-4">
        @if (selectedSprite() && paletteIndices(); as indices) {
          <rk-pixel-canvas
            [paletteIndices]="indices"
            [palette]="projectPalette()"
            [selectedColorIndex]="selectedColorIndex()"
            [tool]="selectedTool()"
            (indicesChange)="onCanvasChange($event)"
          />
        } @else {
          <div class="tw-text-muted-foreground tw-text-center tw-py-20">
            Select a sprite to edit
          </div>
        }
      </div>

      <!-- Right: Tools -->
      <div class="tw-w-56 tw-shrink-0 tw-border-l tw-border-border tw-bg-card tw-p-4 tw-flex tw-flex-col tw-gap-4">
        <rk-palette-manager
          [palette]="projectPalette()"
          [selectedIndex]="selectedPaletteIndex()"
          (selectedIndexChange)="selectedPaletteIndex.set($event)"
        />
        <rk-drawing-tools
          [tool]="selectedTool()"
          (toolChange)="selectedTool.set($event)"
        />
      </div>
    </div>

    @if (spriteToDelete()) {
      <div
        class="tw-fixed tw-inset-0 tw-bg-black/50 tw-flex tw-items-center tw-justify-center tw-z-50"
        tabindex="0"
        (click)="spriteToDelete.set(null)"
        (keydown.enter)="spriteToDelete.set(null)"
        (keydown.escape)="spriteToDelete.set(null)"
      >
        <rk-confirm-dialog
          class="tw-bg-card tw-rounded-lg tw-shadow-lg"
          [data]="deleteDialogData"
          (click)="$event.stopPropagation()"
          (confirmed)="deleteSprite(spriteToDelete()!)"
          (cancelled)="spriteToDelete.set(null)"
        />
      </div>
    }
  `,
})
export class SpriteEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly spriteService = inject(SpriteService);
  private readonly db = inject(DatabaseService);
  private readonly destroyRef = inject(DestroyRef);

  projectId = signal<string>('');
  projectPalette = signal<string[]>([]);
  sprites = signal<Sprite[]>([]);
  selectedSpriteId = signal<number | null>(null);
  selectedSprite = signal<Sprite | null>(null);
  selectedPaletteIndex = signal<number>(0);
  selectedTool = signal<DrawingTool>('brush');
  spriteToDelete = signal<number | null>(null);

  paletteIndices = signal<number[][] | null>(null);

  readonly selectedColorIndex = computed(() => this.selectedPaletteIndex() + 1);

  readonly deleteDialogData: ConfirmDialogData = {
    title: 'Delete Sprite',
    message: 'Are you sure you want to delete this sprite? This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  };

  ngOnInit() {
    this.route.parent?.params.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.projectId.set(id);
        this.loadProjectPalette();
        this.loadSprites();
      }
    });
  }

  async loadProjectPalette() {
    const project = await this.db.projects.get(this.projectId());
    this.projectPalette.set(project?.palette ?? []);
  }

  async loadSprites() {
    const sprites = await this.spriteService.getSprites(this.projectId());
    this.sprites.set(sprites);
  }

  async selectSprite(spriteId: number) {
    this.selectedSpriteId.set(spriteId);
    const sprite = await this.spriteService.getSprite(spriteId);
    this.selectedSprite.set(sprite ?? null);

    if (sprite?.paletteIndices && sprite.paletteIndices.length > 0) {
      this.paletteIndices.set(sprite.paletteIndices.map((row) => [...row]));
    } else if (sprite) {
      const decoded = await this.spriteService.decodePixelData(
        sprite.pixelData,
        this.projectPalette(),
        sprite.width,
        sprite.height,
      );
      this.paletteIndices.set(decoded);
    } else {
      this.paletteIndices.set(null);
    }
  }

  async createSprite() {
    const count = this.sprites().length;
    const sprite = await this.spriteService.createSprite(
      this.projectId(),
      `Sprite ${count + 1}`,
      0, // unassigned tile
    );
    await this.loadSprites();
    await this.selectSprite(sprite.id);
  }

  async onCanvasChange(updatedIndices: number[][]) {
    const sprite = this.selectedSprite();
    if (!sprite) return;

    const pixelData = this.spriteService.encodePixelData(updatedIndices, this.projectPalette());
    await this.spriteService.updateSprite(sprite.id, {
      paletteIndices: updatedIndices,
      pixelData,
    });

    // Optimistically update local state
    this.paletteIndices.set(updatedIndices.map((row) => [...row]));
    this.selectedSprite.update((s) =>
      s ? { ...s, paletteIndices: updatedIndices.map((row) => [...row]), pixelData } : null,
    );
  }

  requestDelete(spriteId: number) {
    this.spriteToDelete.set(spriteId);
  }

  async deleteSprite(spriteId: number) {
    await this.spriteService.deleteSprite(spriteId);
    this.spriteToDelete.set(null);
    if (this.selectedSpriteId() === spriteId) {
      this.selectedSpriteId.set(null);
      this.selectedSprite.set(null);
      this.paletteIndices.set(null);
    }
    await this.loadSprites();
  }
}
