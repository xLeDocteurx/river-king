import {
  Component,
  DestroyRef,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
  computed,
  viewChild,
  effect,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SpriteService } from './services/sprite.service';
import { PixelCanvasComponent } from './pixel-canvas.component';
import { PaletteManagerComponent } from './palette-manager.component';
import { DrawingToolsComponent, type DrawingTool } from './drawing-tools.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ProjectService } from '../dashboard/services/project.service';
import { NotificationService } from '../../core/services/notification.service';
import type { Sprite } from '../../shared/models/sprite.model';

/**
 * Main page component for the sprite editor feature.
 *
 * Displays a list of sprites on the left, a pixel canvas in the center,
 * and drawing tools with palette manager on the right.
 */
@Component({
  selector: 'rk-sprite-editor',
  standalone: true,
  providers: [SpriteService],
  imports: [
    PixelCanvasComponent,
    PaletteManagerComponent,
    DrawingToolsComponent,
    ConfirmDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sprite-editor.component.html',
  styleUrl: './sprite-editor.component.scss',
})
export class SpriteEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly spriteService = inject(SpriteService);
  private readonly projectService = inject(ProjectService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  /** Reference to the confirm dialog component. */
  private readonly confirmDialogRef = viewChild.required(ConfirmDialogComponent);

  /** Reactive signal holding the current project ID. */
  projectId = signal<string>('');

  /** Whether the editor is in focus mode (entered via /sprites/:spriteId). */
  focusMode = signal(false);

  /** Reactive signal holding the project's color palette. */
  projectPalette = signal<string[]>([]);

  /** Reactive signal holding the list of sprites. */
  sprites = signal<Sprite[]>([]);

  /** Reactive signal holding the ID of the currently selected sprite. */
  selectedSpriteId = signal<number | null>(null);

  /** Reactive signal holding the currently selected sprite data. */
  selectedSprite = signal<Sprite | null>(null);

  /** Reactive signal holding the selected palette color index. */
  selectedPaletteIndex = signal<number>(0);

  /** Reactive signal holding the selected drawing tool. */
  selectedTool = signal<DrawingTool>('brush');

  /** Reactive signal tracking which sprite is pending deletion confirmation. */
  spriteToDelete = signal<number | null>(null);

  /** Reactive signal holding the decoded palette indices for the canvas. */
  paletteIndices = signal<number[][] | null>(null);

  /** Computed signal deriving the selected color index (palette index + 1). */
  readonly selectedColorIndex = computed(() => this.selectedPaletteIndex() + 1);

  /** Static configuration for the delete confirmation dialog. */
  readonly deleteDialogData: ConfirmDialogData = {
    title: 'Delete Sprite',
    message: 'Are you sure you want to delete this sprite? This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  };

  constructor() {
    effect(() => {
      const id = this.spriteToDelete();
      if (id !== null) {
        this.confirmDialogRef().open();
      }
    });
  }

  /** Initializes component, subscribing to route params to load project data and optional sprite focus. */
  ngOnInit() {
    const projectParams =
      this.route.pathFromRoot?.find((r) => r.snapshot.paramMap.has('id'))?.params ??
      this.route.parent?.params;
    projectParams?.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.projectId.set(id);
        this.loadProjectPalette();
        this.loadSprites();
      }
    });

    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(async (params) => {
      const raw = params['spriteId'];
      if (raw === null || raw === undefined) {
        this.focusMode.set(false);
        return;
      }
      this.focusMode.set(true);
      try {
        await this.loadSprites();
        const sprite = await this.spriteService.getSprite(Number(raw));
        if (!sprite) {
          this.notification.error('Sprite not found');
          this.backToTiles();
          return;
        }
        await this.selectSprite(sprite.id);
      } catch (e) {
        console.error('Failed to load focused sprite:', e);
        this.notification.error('Failed to load sprite');
      }
    });
  }

  /** Loads the project's color palette from the project service. */
  async loadProjectPalette() {
    try {
      const project = await this.projectService.getById(this.projectId());
      this.projectPalette.set(project?.palette ?? []);
    } catch (e) {
      this.notification.error('Failed to load project');
      console.error(e);
    }
  }

  /** Loads all sprites for the current project from the sprite service. */
  async loadSprites() {
    try {
      const sprites = await this.spriteService.getSprites(this.projectId());
      this.sprites.set(sprites);
    } catch (e) {
      this.notification.error('Failed to load sprites');
      console.error(e);
    }
  }

  /**
   * Selects a sprite by ID and loads its pixel data.
   * @param spriteId - The ID of the sprite to select.
   */
  async selectSprite(spriteId: number) {
    try {
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
    } catch (e) {
      this.notification.error('Failed to load sprite');
      console.error(e);
    }
  }

  /** Creates a new sprite for the current project. */
  async createSprite() {
    try {
      const count = this.sprites().length;
      const sprite = await this.spriteService.createSprite(
        this.projectId(),
        `Sprite ${count + 1}`,
        0,
      );
      await this.loadSprites();
      await this.selectSprite(sprite.id);
    } catch (e) {
      this.notification.error('Failed to create sprite');
      console.error(e);
    }
  }

  /**
   * Handles canvas changes by encoding and saving pixel data.
   * @param updatedIndices - The updated 2D array of palette indices.
   */
  async onCanvasChange(updatedIndices: number[][]) {
    try {
      const sprite = this.selectedSprite();
      if (!sprite) return;

      const pixelData = this.spriteService.encodePixelData(updatedIndices, this.projectPalette());
      await this.spriteService.updateSprite(sprite.id, {
        paletteIndices: updatedIndices,
        pixelData,
      });

      this.paletteIndices.set(updatedIndices.map((row) => [...row]));
      this.selectedSprite.update((s) =>
        s ? { ...s, paletteIndices: updatedIndices.map((row) => [...row]), pixelData } : null,
      );
    } catch (e) {
      this.notification.error('Failed to save sprite');
      console.error(e);
    }
  }

  /**
   * Navigates back to the tile manager for the current project.
   */
  backToTiles(): void {
    this.router.navigate(['/project', this.projectId(), 'tiles']);
  }

  /**
   * Requests deletion confirmation for the specified sprite.
   * @param spriteId - The ID of the sprite to delete.
   */
  requestDelete(spriteId: number) {
    this.spriteToDelete.set(spriteId);
  }

  /**
   * Deletes the specified sprite after confirmation.
   * @param spriteId - The ID of the sprite to delete.
   */
  async deleteSprite(spriteId: number) {
    try {
      await this.spriteService.deleteSprite(spriteId);
      this.spriteToDelete.set(null);
      if (this.selectedSpriteId() === spriteId) {
        this.selectedSpriteId.set(null);
        this.selectedSprite.set(null);
        this.paletteIndices.set(null);
      }
      await this.loadSprites();
    } catch (e) {
      this.notification.error('Failed to delete sprite');
      console.error(e);
    }
  }
}
