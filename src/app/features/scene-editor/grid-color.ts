/**
 * Resolves the map grid stroke color from the active theme.
 *
 * Canvas contexts cannot consume CSS custom properties directly, so the
 * theme's `--border` token is read from computed styles at render time.
 * This keeps the grid visible in both light and dark themes.
 * @param element - An element attached to the document whose computed
 *     styles inherit the design tokens.
 * @returns A CSS color string usable as a canvas `strokeStyle`.
 */
export function gridStrokeColor(element: HTMLElement): string {
  const token = getComputedStyle(element).getPropertyValue('--border').trim();
  return token.length > 0 ? token : 'rgba(127, 127, 127, 0.35)';
}
