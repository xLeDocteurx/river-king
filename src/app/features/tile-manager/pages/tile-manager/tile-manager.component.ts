import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  selector: 'rk-tile-manager',
  styles: [],
  template: `<p class="tw-text-muted-foreground">Tile Manager (placeholder)</p>`,
})
export class TileManagerComponent {}
