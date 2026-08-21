import { Component, input, output, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { CdkDropListGroup, CdkDropList, CdkDrag, type CdkDragDrop } from '@angular/cdk/drag-drop';
import type { Scene } from '../../../../shared/models/scene.model';

/**
 * Displays scenes grouped by folderPath with drag-and-drop support.
 * Scenes can be moved between groups via Angular CDK drag-and-drop.
 */
@Component({
  selector: 'rk-scene-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag],
  templateUrl: './scene-list.component.html',
  styleUrl: './scene-list.component.scss',
})
export class SceneListComponent {
  /** All scenes to display, grouped by folderPath. */
  scenes = input.required<Scene[]>();
  /** Id of the currently selected scene. */
  selectedSceneId = input<string | null>(null);
  /** Emitted when a scene is selected. */
  sceneSelect = output<string>();
  /** Emitted when the user requests creation of a new scene. */
  createScene = output<void>();
  /** Emitted when a scene is moved to a different folder. */
  sceneFolderChange = output<{ sceneId: string; folderPath: string }>();

  /** Locally created empty group names. */
  customGroups = signal<string[]>([]);

  /** Computed grouping of scenes by folderPath, including any empty custom groups. */
  groups = computed<{ folderPath: string; scenes: Scene[] }[]>(() => {
    const map = new Map<string, Scene[]>();
    for (const scene of this.scenes()) {
      const folder = scene.folderPath || '';
      const arr = map.get(folder) ?? [];
      arr.push(scene);
      map.set(folder, arr);
    }
    for (const group of this.customGroups()) {
      if (!map.has(group)) {
        map.set(group, []);
      }
    }
    return Array.from(map.entries())
      .map(([folderPath, scenes]) => ({ folderPath, scenes }))
      .sort((a, b) => a.folderPath.localeCompare(b.folderPath));
  });

  /**
   * Prompts the user for a group name and adds it to the local group list.
   */
  onCreateGroup(): void {
    const name = window.prompt('Enter group name:')?.trim();
    if (!name) return;
    if (this.customGroups().includes(name)) return;
    const existsInScenes = this.scenes().some((s) => s.folderPath === name);
    if (existsInScenes) return;
    this.customGroups.update((groups) => [...groups, name]);
  }

  /**
   * Handles a CDK drop event. Emits folderChange when a scene is moved between groups.
   * @param event The CDK drag-drop event.
   * @param targetFolderPath The folder path of the drop target group.
   */
  onDrop(event: CdkDragDrop<Scene[]>, targetFolderPath: string): void {
    if (event.previousContainer === event.container) return;
    const scene = event.item.data as Scene;
    if (scene.folderPath !== targetFolderPath) {
      this.sceneFolderChange.emit({ sceneId: scene.id, folderPath: targetFolderPath });
    }
  }
}
