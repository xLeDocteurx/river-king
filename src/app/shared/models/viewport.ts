import type { Project } from './project.model';

/**
 * A selectable play-viewport resolution preset.
 */
export interface ViewPreset {
  /** Human-readable label shown in the project create dialog. */
  label: string;
  /** Viewport width in game pixels. */
  width: number;
  /** Viewport height in game pixels. */
  height: number;
}

/** Default play-viewport width in game pixels (`256`, exactly 16:9). */
export const DEFAULT_VIEW_WIDTH = 256;

/** Default play-viewport height in game pixels (`144`, exactly 16:9). */
export const DEFAULT_VIEW_HEIGHT = 144;

/** Viewport presets offered at creation time; the first entry is the default. */
export const VIEW_PRESETS: readonly ViewPreset[] = [
  { label: '256 × 144 (16:9)', width: 256, height: 144 },
  { label: '320 × 180 (16:9)', width: 320, height: 180 },
  { label: '384 × 216 (16:9)', width: 384, height: 216 },
  { label: '256 × 224 (SNES 4:3)', width: 256, height: 224 },
];

/**
 * Resolves the effective play viewport of a project, falling back to the default
 * 16:9 resolution when the project predates the setting or carries invalid values.
 * @param project - Any object carrying optional `viewWidth` / `viewHeight`.
 * @returns The resolved width and height in game pixels.
 */
export function resolveViewport(project: Pick<Project, 'viewWidth' | 'viewHeight'>): {
  width: number;
  height: number;
} {
  const width = project.viewWidth && project.viewWidth > 0 ? project.viewWidth : DEFAULT_VIEW_WIDTH;
  const height =
    project.viewHeight && project.viewHeight > 0 ? project.viewHeight : DEFAULT_VIEW_HEIGHT;
  return { width, height };
}
