import {
  Component,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
  computed,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatabaseService } from '../../core/services/database.service';
import { NotificationService } from '../../core/services/notification.service';
import { SceneService } from './services/scene.service';
import { MapCanvasComponent } from './map-canvas.component';
import { SceneListComponent } from './scene-list.component';
import { TilePaletteComponent } from './tile-palette.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import type { Scene } from '../../shared/models/scene.model';
import type { Tile } from '../../shared/models/tile.model';
import type { ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';

/**
 * Main page component for the Scene Editor feature.
 * Orchestrates scene selection, tile placement, scene group management,
 * and scene deletion (with confirmation).
 */
@Component({
  selector: 'rk-scene-editor',
  standalone: true,
  providers: [SceneService],
  imports: [MapCanvasComponent, SceneListComponent, TilePaletteComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scene-editor.component.html',
  styleUrl: './scene-editor.component.scss',
})
export class SceneEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly sceneService = inject(SceneService);
  private readonly db = inject(DatabaseService);
  private readonly notification = inject(NotificationService);
  private readonly deleteConfirmDialog = viewChild.required(ConfirmDialogComponent);

  /** Currently active project id derived from route params. */
  projectId = signal<string>('');
  /** Palette colors defined for the current project. */
  projectPalette = signal<string[]>([]);
  /** Tiles belonging to the current project. */
  projectTiles = signal<Tile[]>([]);
  /** List of all scenes for the current project. */
  scenes = signal<Scene[]>([]);
  /** Persisted folder paths for the current project. */
  folders = signal<string[]>([]);
  /** Id of the currently selected scene. */
  selectedSceneId = signal<string | null>(null);
  /** Full object of the currently selected scene. */
  selectedScene = signal<Scene | null>(null);
  /** Id of the tile currently selected in the palette. */
  selectedTileId = signal<number | null>(null);
  /** Id of the scene pending deletion confirmation. */
  pendingDeleteSceneId = signal<string | null>(null);

  /** Data for the scene deletion confirmation dialog. */
  deleteDialogData = computed<ConfirmDialogData>(() => {
    const scene = this.scenes().find((s) => s.id === this.pendingDeleteSceneId());
    return {
      title: 'Delete Scene',
      message: scene
        ? `Are you sure you want to delete "${scene.name}"? This cannot be undone.`
        : 'Are you sure you want to delete this scene? This cannot be undone.',
      confirmLabel: 'Delete',
    };
  });

  ngOnInit(): void {
    this.route.parent?.params.subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.projectId.set(id);
        this.loadProjectData();
        this.loadScenes();
        this.loadFolders();
      }
    });
  }

  /**
   * Loads project palette and tiles for the current project.
   */
  async loadProjectData(): Promise<void> {
    try {
      const project = await this.db.projects.get(this.projectId());
      if (project) {
        this.projectPalette.set(project.palette);
      }
      const tiles = await this.db.tiles.where('projectId').equals(this.projectId()).toArray();
      this.projectTiles.set(tiles);
    } catch (e) {
      console.error('Failed to load project data:', e);
      this.notification.error('Failed to load project data.');
    }
  }

  /**
   * Loads all scenes for the current project from IndexedDB.
   */
  async loadScenes(): Promise<void> {
    try {
      const scenes = await this.sceneService.getScenes(this.projectId());
      this.scenes.set(scenes);
    } catch (e) {
      console.error('Failed to load scenes:', e);
      this.notification.error('Failed to load scenes.');
    }
  }

  /**
   * Loads all persisted folder paths for the current project.
   */
  async loadFolders(): Promise<void> {
    try {
      const folders = await this.sceneService.getFolders(this.projectId());
      this.folders.set(folders.map((f) => f.path));
    } catch (e) {
      console.error('Failed to load folders:', e);
      this.notification.error('Failed to load folders.');
    }
  }

  /**
   * Selects a scene by id and loads its full data.
   * @param sceneId The id of the scene to select.
   */
  async selectScene(sceneId: string): Promise<void> {
    this.selectedSceneId.set(sceneId);
    const scene = await this.sceneService.getScene(sceneId);
    this.selectedScene.set(scene ?? null);
  }

  /**
   * Creates a new scene for the current project and refreshes the list.
   */
  async onCreateScene(): Promise<void> {
    try {
      await this.sceneService.createScene(
        this.projectId(),
        `Scene ${this.scenes().length + 1}`,
        40,
        30,
      );
      await this.loadScenes();
    } catch (e) {
      console.error('Failed to create scene:', e);
      this.notification.error('Failed to create the scene.');
    }
  }

  /**
   * Persists a new folder for the current project and refreshes the list.
   * @param path The folder path requested by the user.
   */
  async onCreateFolder(path: string): Promise<void> {
    if (!path) return;
    try {
      await this.sceneService.createFolder(this.projectId(), path);
      await this.loadFolders();
    } catch (e) {
      console.error('Failed to create folder:', e);
      this.notification.error('Failed to create the folder.');
    }
  }

  /**
   * Opens the deletion confirmation dialog for a scene.
   * @param sceneId The id of the scene the user wants to delete.
   */
  onDeleteSceneRequest(sceneId: string): void {
    this.pendingDeleteSceneId.set(sceneId);
    this.deleteConfirmDialog().open();
  }

  /**
   * Deletes the pending scene after user confirmation, then refreshes the list.
   * Clears the selection when the deleted scene was the selected one.
   */
  async onConfirmDelete(): Promise<void> {
    const sceneId = this.pendingDeleteSceneId();
    if (!sceneId) return;
    this.pendingDeleteSceneId.set(null);
    try {
      await this.sceneService.deleteScene(sceneId);
      await this.loadScenes();
      if (this.selectedSceneId() === sceneId) {
        this.selectedSceneId.set(null);
        this.selectedScene.set(null);
      }
      this.notification.success('Scene deleted.');
    } catch (e) {
      console.error('Failed to delete scene:', e);
      this.notification.error('Failed to delete the scene.');
    }
  }

  /**
   * Updates the folder path of a scene and refreshes the list.
   * @param event Object containing the scene id and target folder path.
   */
  async onSceneFolderChange(event: { sceneId: string; folderPath: string }): Promise<void> {
    try {
      await this.sceneService.updateSceneFolder(event.sceneId, event.folderPath);
      await this.loadScenes();
    } catch (e) {
      console.error('Failed to move scene:', e);
      this.notification.error('Failed to move the scene.');
    }
  }

  /**
   * Handles a tile placement event from the map canvas.
   * @param event Object containing x, y coordinates and the placed tile id.
   */
  async onTilePlaced(event: { x: number; y: number; tileId: number }): Promise<void> {
    const scene = this.selectedScene();
    if (!scene) return;

    try {
      const newTileData = scene.tileData.map((row) => [...row]);
      newTileData[event.y][event.x] = event.tileId;

      await this.sceneService.updateScene(scene.id, { tileData: newTileData });
      this.selectedScene.update((s) => (s ? { ...s, tileData: newTileData } : null));
    } catch (e) {
      console.error('Failed to place tile:', e);
      this.notification.error('Failed to place the tile.');
    }
  }
}
