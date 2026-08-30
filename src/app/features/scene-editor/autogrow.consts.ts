/**
 * Maximum number of tiles the scene may grow in a single direction from one
 * placement. Beyond this the placement is rejected to avoid accidental
 * ballooning (a stray click can otherwise sit hundreds of cells away when
 * zoomed out).
 */
export const MAX_EXPAND_TILES = 16;

/**
 * Canvas alpha applied to the grid overlay outside the in-memory scene
 * rectangle, so extendable space is visible but clearly secondary.
 */
export const GRID_EXT_ALPHA = 0.35;
