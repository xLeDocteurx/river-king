import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  selector: 'rk-sprite-editor',
  styles: [],
  template: `<p class="tw-text-muted-foreground">Sprite Editor (placeholder)</p>`,
})
export class SpriteEditorComponent {}
