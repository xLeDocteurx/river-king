import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  selector: 'rk-scene-editor',
  styles: [],
  template: `<p class="tw-text-muted-foreground">Scene Editor (placeholder)</p>`,
})
export class SceneEditorComponent {}
