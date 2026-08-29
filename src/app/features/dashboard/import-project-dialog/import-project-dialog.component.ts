import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { ImportMode } from '../../../core/services/project-io.service';
import { ProjectArchive } from '../../../shared/models/project-archive.model';
import { Project } from '../../../shared/models/project.model';

/**
 * Modal dialog asking where an imported archive should land: a brand-new
 * project or an in-place replacement of an existing one.
 *
 * Displays a compact summary of the archive contents and lets the user pick
 * the import target. The chosen mode is emitted through {@link confirmed}
 * (the parent owns the actual import); dismissing without a choice emits
 * {@link cancelled}.
 */
@Component({
  selector: 'rk-import-project-dialog',
  standalone: true,
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './import-project-dialog.component.html',
  styleUrl: './import-project-dialog.component.scss',
})
export class ImportProjectDialogComponent {
  /**
   * The parsed archive being imported, or null when no file is pending.
   */
  readonly archive = input<ProjectArchive | null>(null);

  /**
   * Existing projects offered as replacement targets.
   */
  readonly projects = input<Project[]>([]);

  /**
   * Emitted with the chosen import mode when the user confirms.
   */
  readonly confirmed = output<ImportMode>();

  /**
   * Emitted when the user dismisses the dialog without confirming.
   */
  readonly cancelled = output<void>();

  /** Reference to the wrapped native dialog. */
  private readonly dialogRef = viewChild.required(DialogComponent);

  /** Whether the user chose to replace an existing project. */
  readonly replaceMode = signal(false);

  /** Id of the project chosen as the replacement target, if any. */
  readonly selectedProjectId = signal<string | null>(null);

  /** Number of tiles in the archive. */
  readonly tileCount = computed(() => this.archive()?.tiles.length ?? 0);

  /** Number of frames (sprites) in the archive. */
  readonly frameCount = computed(() => this.archive()?.sprites.length ?? 0);

  /** Number of scenes in the archive. */
  readonly sceneCount = computed(() => this.archive()?.scenes.length ?? 0);

  /** Number of colors in the project palette. */
  readonly paletteCount = computed(() => this.archive()?.project.palette.length ?? 0);

  /**
   * True when a valid import target is chosen: an archive exists and, in
   * replace mode, a real project is selected.
   */
  readonly canConfirm = computed(
    () =>
      this.archive() !== null &&
      (!this.replaceMode() ||
        (this.selectedProjectId() !== null &&
          this.projects().some((p) => p.id === this.selectedProjectId()))),
  );

  /**
   * Opens the dialog and resets any previous choice.
   */
  open(): void {
    this.replaceMode.set(false);
    this.selectedProjectId.set(null);
    this.dialogRef().open();
  }

  /** Selects the "create a new project" mode. */
  chooseNew(): void {
    this.replaceMode.set(false);
  }

  /** Selects the "replace an existing project" mode. */
  chooseReplace(): void {
    this.replaceMode.set(true);
  }

  /**
   * Records the project selected in the dropdown.
   * @param event The select change event.
   */
  onSelectChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedProjectId.set(value === '' ? null : value);
  }

  /**
   * Emits the resolved import mode when a valid target is selected.
   */
  confirm(): void {
    if (!this.canConfirm()) return;
    const mode: ImportMode = this.replaceMode()
      ? { kind: 'replace', targetProjectId: this.selectedProjectId() as string }
      : { kind: 'new' };
    this.confirmed.emit(mode);
  }

  /** Closes the dialog without confirming. */
  cancel(): void {
    this.dialogRef().close();
  }

  /**
   * Closes the dialog after the parent has completed the import.
   */
  close(): void {
    this.dialogRef().close();
  }

  /**
   * Forwards the native dialog close to the parent.
   * @internal
   */
  onDialogClosed(): void {
    this.cancelled.emit();
  }
}