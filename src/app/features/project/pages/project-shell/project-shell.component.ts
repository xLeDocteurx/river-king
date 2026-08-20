import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  selector: 'rk-project-shell',
  styles: [],
  template: `<router-outlet />`,
})
export class ProjectShellComponent {}
