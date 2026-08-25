import {
  Component,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
  computed,
  viewChild,
  effect,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatabaseService } from '../../core/services/database.service';
import { NotificationService } from '../../core/services/notification.service';
import { SessionService } from '../../core/services/session.service';
import { StatusBarService } from '../../core/services/status-bar.service';
import { SceneService } from './services/scene.service';
import { MapTilesService } from './services/map-tiles.service';
import type { TileAnimationMeta } from './services/map-tiles.service';
import { MapCanvasComponent } from './map-canvas.component';
import { SceneMinimapComponent } from './minimap/scene-minimap.component';
import { clearOverlappedAnchors, getFootprint } from './map-footprint';
import { SceneListComponent } from './scene-list.component';
import { TilePaletteComponent } from './tile-palette.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import type { Scene } from '../../shared/models/scene.model';
import type { Tile } from '../../shared/models/tile.model';
import type { ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import type { TileFootprintMap } from './map-footprint';

/**
 * Main page component for the Scene Editor feature.
 * Orchestrates scene selection, tile placement, scene group management,
 * and scene deletion (with confirmation).
 */
@Component({
  selector: 'rk-scene-editor',
  standalone: true,
  providers: [SceneService, MapTilesService],
  imports: [
    MapCanvasComponent,
    SceneMinimapComponent,
    SceneListComponent,
    TilePaletteComponent,
    ConfirmDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scene-editor.component.html',
  styleUrl: './scene-editor.component.scss',
})
export class SceneEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sceneService = inject(SceneService);
  private readonly db = inject(DatabaseService);
  private readonly notification = inject(NotificationService);
  private readonly mapTilesService = inject(MapTilesService);
  private readonly sessions = inject(SessionService);
  private readonly statusBar = inject(StatusBarService);
  private readonly deleteConfirmDialog = viewChild.required(ConfirmDialogComponent);
  mapCanvasRef = viewChild(MapCanvasComponent);

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
  /** Cached tileId -> frame image sources map for canvas rendering. */
  tileImages = signal<Record<number, string[]>>({});
  /** First-frame image per tile for the palette sidebar. */
  tileFirstFrames = signal<Record<number, string>>({});
  /** Animation metadata per tile id (absent for static tiles). */
  tileAnimations = signal<Record<number, TileAnimationMeta>>({});
  /** Grid-cell footprint of each tile, derived from its first sprite. */
  tileFootprints = signal<TileFootprintMap>({});
  /** Size of one grid cell in pixels, from the project settings. */
  projectTileSize = signal<number>(16);
  /** Id of the scene pending deletion confirmation. */
  pendingDeleteSceneId = signal<string | null>(null);
  /** Camera state to restore on the map canvas (consumed once, then null). */
  restoreCamera = signal<{ x: number; y: number; zoom: number } | null>(null);
  /**
   * Horizontal camera offset bound to the map canvas. Updated whenever a
   * scene is selected so the canvas snaps to the last stored position.
   */
  initialCameraX = signal(0);
  /**
   * Vertical camera offset bound to the map canvas. Updated whenever a
   * scene is selected so the canvas snaps to the last stored position.
   */
  initialCameraY = signal(0);

  /** Effect that updates the global status bar with scene and camera info. */
  statusBarEffect = effect(() => {
    const scene = this.selectedScene();
    const canvas = this.mapCanvasRef();
    if (!scene || !canvas) {
      this.statusBar.setContext('No scene selected');
      return;
    }
    const x = Math.round(canvas.cameraX());
    const y = Math.round(canvas.cameraY());
    const zoom = Math.round(canvas.zoom() * 100);
    this.statusBar.setContext(
      `${scene.name} | ${scene.width}×${scene.height} | Cam: ${x},${y} | Zoom: ${zoom}%`,
    );
  });

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
        this.loadScenes()
          .then(() => this.restoreSession())
          .catch(() => undefined);
        this.loadFolders();
      }
    });
  }

  /**
   * Restores the persisted session for the scenes screen: re-selects the last
   * active scene (or the scene from the URL when deep-linked) and prepares
   * the camera state for the map canvas.
   */
  async restoreSession(): Promise<void> {
    const stored = await this.sessions.getSession(this.projectId()).catch(() => undefined);

    const urlSceneId = this.route.snapshot.paramMap.get('sceneId');
    let target = urlSceneId ?? undefined;
    if (!target && stored?.lastSceneId) target = stored.lastSceneId;
    if (target && !this.scenes().some((s) => s.id === target)) target = undefined;

    if (target) await this.selectScene(target);
    if (stored && (stored.cameraX !== 0 || stored.cameraY !== 0 || stored.cameraZoom !== 1)) {
      this.restoreCamera.set({ x: stored.cameraX, y: stored.cameraY, zoom: stored.cameraZoom });
    }
  }

  /**
   * Loads project palette, tiles, and tile images for the current project.
   */
  async loadProjectData(): Promise<void> {
    try {
      const project = await this.db.projects.get(this.projectId());
      if (project) {
        this.projectPalette.set(project.palette);
        this.projectTileSize.set(project.tileSize ?? 16);
      }
      const tiles = await this.db.tiles.where('projectId').equals(this.projectId()).toArray();
      this.projectTiles.set(tiles);
      await this.loadTileVisuals();
    } catch (e) {
      console.error('Failed to load project data:', e);
      this.notification.error('Failed to load project data.');
    }
  }

  /**
   * Loads all sprite frame images, animation metadata, and footprints of each tile in the project.
   */
  async loadTileVisuals(): Promise<void> {
    try {
      const { images, animations, footprints } = await this.mapTilesService.loadTileVisuals(
        this.projectId(),
        this.projectTileSize(),
      );
      this.tileImages.set(images);
      this.tileAnimations.set(animations);
      this.tileFootprints.set(footprints);
      // Derive first-frame map for the palette sidebar.
      const firstFrames: Record<number, string> = {};
      for (const tileId of Object.keys(images).map(Number)) {
        if (images[tileId].length > 0) firstFrames[tileId] = images[tileId][0];
      }
      this.tileFirstFrames.set(firstFrames);
    } catch (e) {
      console.error('Failed to load tile images:', e);
      this.notification.error('Failed to load tile images.');
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
    try {
      const scene = await this.sceneService.getScene(sceneId);
      this.selectedScene.set(scene ?? null);
      void this.sessions.updateSession(this.projectId(), {
        lastScreen: 'scenes',
        lastSceneId: sceneId,
      });
      const stored = await this.sessions.getSession(this.projectId()).catch(() => undefined);
      this.initialCameraX.set(stored?.cameraX ?? 0);
      this.initialCameraY.set(stored?.cameraY ?? 0);
      if (this.route.snapshot.paramMap.get('sceneId') !== String(sceneId)) {
        void this.router.navigate(['/project', this.projectId(), 'scenes', sceneId]);
      }
    } catch (e) {
      console.error('Failed to load scene:', e);
      this.notification.error('Failed to load the scene.');
    }
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
   * Handles a camera jump from the minimap: centers the canvas on the
   * clicked world-space point.
   * @param event Object containing the world-space x, y to center on.
   */
  onMinimapJump(event: { x: number; y: number }): void {
    this.mapCanvasRef()?.centerOn(event.x, event.y);
  }

  /**
   * Handles a tile placement event from the map canvas: removes every anchor
   * overlapping the incoming footprint (Replace policy), writes the new anchor,
   * then persists the updated grid.
   * @param event Object containing x, y coordinates and the placed tile id.
   */
  async onTilePlaced(event: { x: number; y: number; tileId: number }): Promise<void> {
    const scene = this.selectedScene();
    if (!scene) return;

    try {
      const { w, h } = getFootprint(event.tileId, this.tileFootprints());
      const newTileData = clearOverlappedAnchors(
        scene.tileData,
        event.x,
        event.y,
        w,
        h,
        this.tileFootprints(),
      );
      newTileData[event.y][event.x] = event.tileId;

      await this.sceneService.updateScene(scene.id, { tileData: newTileData });
      this.selectedScene.update((s) => (s ? { ...s, tileData: newTileData } : null));
    } catch (e) {
      console.error('Failed to place tile:', e);
      this.notification.error('Failed to place the tile.');
    }
  }
}
