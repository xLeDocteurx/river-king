import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import type { Scene } from '../../../../shared/models/scene.model';

@Component({
  selector: 'rk-scene-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-flex tw-flex-col tw-h-full tw-bg-card tw-border-r tw-border-border">
      <div class="tw-flex tw-items-center tw-justify-between tw-px-4 tw-py-3 tw-border-b tw-border-border">
        <h3 class="tw-font-semibold tw-text-foreground">Scenes</h3>
        <button
          type="button"
          (click)="createScene.emit()"
          class="tw-p-1 tw-rounded-md hover:tw-bg-muted"
          title="New Scene"
        >
          <span class="material-symbols" aria-hidden="true">add</span>
        </button>
      </div>
      <div class="tw-flex-1 tw-overflow-auto tw-p-2">
        @for (scene of scenes(); track scene.id) {
          <button
            type="button"
            (click)="sceneSelect.emit(scene.id)"
            [class.tw-bg-primary/10]="selectedSceneId() === scene.id"
            class="tw-w-full tw-text-left tw-px-3 tw-py-2 tw-rounded-md tw-text-sm tw-text-foreground hover:tw-bg-muted tw-transition tw-flex tw-items-center tw-gap-2"
          >
            <span class="material-symbols tw-text-muted-foreground" aria-hidden="true">map</span>
            <span>{{ scene.name }}</span>
          </button>
        } @empty {
          <div class="tw-text-muted-foreground tw-text-sm tw-text-center tw-py-4">No scenes yet</div>
        }
      </div>
    </div>
  `,
})
export class SceneListComponent {
  scenes = input.required<Scene[]>();
  selectedSceneId = input<string | null>(null);
  sceneSelect = output<string>();
  createScene = output<void>();
}
