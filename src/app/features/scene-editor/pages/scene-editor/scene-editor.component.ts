import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SceneService } from '../../services/scene.service';
import { MapCanvasComponent } from '../../components/map-canvas/map-canvas.component';
import { SceneListComponent } from '../../components/scene-list/scene-list.component';
import { TilePaletteComponent } from '../../components/tile-palette/tile-palette.component';
import type { Scene } from '../../../../shared/models/scene.model';

/**
 * Main page component for the Scene Editor feature.
 * Orchestrates scene selection, tile placement, and scene group management.
 */
@Component({
  selector: 'rk-scene-editor',
  standalone: true,
  providers: [SceneService],
  imports: [MapCanvasComponent, SceneListComponent, TilePaletteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scene-editor.component.html',
  styleUrl: './scene-editor.component.scss',
})
export class SceneEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly sceneService = inject(SceneService);

  /** Currently active project id derived from route params. */
  projectId = signal<string>('');
  /** List of all scenes for the current project. */
  scenes = signal<Scene[]>([]);
  /** Id of the currently selected scene. */
  selectedSceneId = signal<string | null>(null);
  /** Full object of the currently selected scene. */
  selectedScene = signal<Scene | null>(null);
  /** Id of the tile currently selected in the palette. */
  selectedTileId = signal<number | null>(null);

  ngOnInit(): void {
    this.route.parent?.params.subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.projectId.set(id);
        this.loadScenes();
      }
    });
  }

  /**
   * Loads all scenes for the current project from IndexedDB.
   */
  async loadScenes(): Promise<void> {
    const scenes = await this.sceneService.getScenes(this.projectId());
    this.scenes.set(scenes);
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
    await this.sceneService.createScene(
      this.projectId(),
      `Scene ${this.scenes().length + 1}`,
      40,
      30,
    );
    await this.loadScenes();
  }

  /**
   * Updates the folder path of a scene and refreshes the list.
   * @param event Object containing the scene id and target folder path.
   */
  async onSceneFolderChange(event: { sceneId: string; folderPath: string }): Promise<void> {
    await this.sceneService.updateSceneFolder(event.sceneId, event.folderPath);
    await this.loadScenes();
  }

  /**
   * Handles a tile placement event from the map canvas.
   * @param event Object containing x, y coordinates and the placed tile id.
   */
  async onTilePlaced(event: { x: number; y: number; tileId: number }): Promise<void> {
    const scene = this.selectedScene();
    if (!scene) return;

    const newTileData = scene.tileData.map((row) => [...row]);
    newTileData[event.y][event.x] = event.tileId;

    await this.sceneService.updateScene(scene.id, { tileData: newTileData });
    this.selectedScene.update((s) => (s ? { ...s, tileData: newTileData } : null));
  }
}
