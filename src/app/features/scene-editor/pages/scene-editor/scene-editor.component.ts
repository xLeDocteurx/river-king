import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SceneService } from '../../services/scene.service';
import { MapCanvasComponent } from '../../components/map-canvas/map-canvas.component';
import { SceneListComponent } from '../../components/scene-list/scene-list.component';
import { TilePaletteComponent } from '../../components/tile-palette/tile-palette.component';
import type { Scene } from '../../../../shared/models/scene.model';

@Component({
  selector: 'rk-scene-editor',
  standalone: true,
  providers: [SceneService],
  imports: [MapCanvasComponent, SceneListComponent, TilePaletteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-flex tw-h-full">
      <rk-scene-list
        class="tw-w-64 tw-shrink-0"
        [scenes]="scenes()"
        [selectedSceneId]="selectedSceneId()"
        (sceneSelect)="selectScene($event)"
        (createScene)="onCreateScene()"
      />
      <div class="tw-flex-1 tw-relative tw-overflow-hidden">
        <rk-map-canvas
          [scene]="selectedScene()"
          [selectedTileId]="selectedTileId()"
          (tilePlaced)="onTilePlaced($event)"
        />
      </div>
      <rk-tile-palette
        class="tw-w-64 tw-shrink-0"
        [projectId]="projectId()"
        [selectedTileId]="selectedTileId()"
        (tileSelect)="selectedTileId.set($event)"
      />
    </div>
  `,
})
export class SceneEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly sceneService = inject(SceneService);

  projectId = signal<string>('');
  scenes = signal<Scene[]>([]);
  selectedSceneId = signal<string | null>(null);
  selectedScene = signal<Scene | null>(null);
  selectedTileId = signal<number | null>(null);

  ngOnInit() {
    this.route.parent?.params.subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.projectId.set(id);
        this.loadScenes();
      }
    });
  }

  async loadScenes() {
    const scenes = await this.sceneService.getScenes(this.projectId());
    this.scenes.set(scenes);
  }

  async selectScene(sceneId: string) {
    this.selectedSceneId.set(sceneId);
    const scene = await this.sceneService.getScene(sceneId);
    this.selectedScene.set(scene ?? null);
  }

  async onCreateScene() {
    await this.sceneService.createScene(
      this.projectId(),
      `Scene ${this.scenes().length + 1}`,
      40,
      30,
    );
    await this.loadScenes();
  }

  async onTilePlaced(event: { x: number; y: number; tileId: number }) {
    const scene = this.selectedScene();
    if (!scene) return;

    const newTileData = scene.tileData.map((row) => [...row]);
    newTileData[event.y][event.x] = event.tileId;

    await this.sceneService.updateScene(scene.id, { tileData: newTileData });
    this.selectedScene.update((s) => (s ? { ...s, tileData: newTileData } : null));
  }
}
