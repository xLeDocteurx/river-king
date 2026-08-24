/**
 * Resolves a CSS custom property as a color usable by canvas contexts.
 *
 * Canvas contexts cannot consume CSS custom properties directly, so the
 * token is read from computed styles at render time. This keeps canvas
 * visuals consistent with the active theme.
 * @param element - An element attached to the document whose computed
 *     styles inherit the design tokens.
 * @param token - Name of the CSS custom property to read (e.g. `--border`).
 * @param fallback - Color returned when the token is missing or empty
 *     (e.g. in tests where jsdom does not resolve custom properties).
 * @returns A CSS color string.
 */
export function cssTokenColor(element: HTMLElement, token: string, fallback: string): string {
  const value = getComputedStyle(element).getPropertyValue(token).trim();
  return value.length > 0 ? value : fallback;
}

/**
 * Resolves the map grid stroke color from the active theme.
 *
 * Reads the theme's `--border` token so the grid stays visible in both
 * light and dark themes.
 * @param element - An element attached to the document whose computed
 *     styles inherit the design tokens.
 * @returns A CSS color string usable as a canvas `strokeStyle`.
 */
export function gridStrokeColor(element: HTMLElement): string {
  return cssTokenColor(element, '--border', 'rgba(127, 127, 127, 0.35)');
}
