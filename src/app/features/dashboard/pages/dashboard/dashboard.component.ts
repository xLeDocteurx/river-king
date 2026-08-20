import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  selector: 'rk-dashboard',
  styles: [],
  template: `<p class="tw-text-muted-foreground">Dashboard (placeholder)</p>`,
})
export class DashboardComponent {}
