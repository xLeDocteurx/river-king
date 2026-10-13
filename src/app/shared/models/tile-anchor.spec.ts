import { clampAnchor, deriveAnchor, deriveFootprint } from './tile-anchor';

describe('deriveAnchor', () => {
  it('centers a 16x16 sprite at the bottom of its single cell', () => {
    expect(deriveAnchor(16, 16, 16)).toEqual({ x: 0, y: 0 });
  });

  it('places a 16x32 sprite in the bottom cell (canopy above)', () => {
    expect(deriveAnchor(16, 32, 16)).toEqual({ x: 0, y: 16 });
  });

  it('centers a 32x32 sprite horizontally in its bottom cells', () => {
    expect(deriveAnchor(32, 32, 16)).toEqual({ x: 8, y: 16 });
  });

  it('centers a 32x40 sprite with an even 8px x offset', () => {
    expect(deriveAnchor(32, 40, 16)).toEqual({ x: 8, y: 24 });
  });

  it('centers a 48x32 sprite (x = 16)', () => {
    expect(deriveAnchor(48, 32, 16)).toEqual({ x: 16, y: 16 });
  });

  it('clamps to zero when the sprite is smaller than the tile size', () => {
    expect(deriveAnchor(8, 8, 16)).toEqual({ x: 0, y: 0 });
  });
});

describe('clampAnchor', () => {
  it('clamps an anchor past the frame bounds back inside', () => {
    expect(clampAnchor({ x: 24, y: 64 }, 32, 64, 16)).toEqual({ x: 16, y: 48 });
  });

  it('clamps negative coordinates to zero', () => {
    expect(clampAnchor({ x: -5, y: -9 }, 32, 32, 16)).toEqual({ x: 0, y: 0 });
  });

  it('leaves an in-bounds anchor unchanged', () => {
    expect(clampAnchor({ x: 8, y: 16 }, 32, 64, 16)).toEqual({ x: 8, y: 16 });
  });

  it('floors fractional coordinates', () => {
    expect(clampAnchor({ x: 7.9, y: 15.2 }, 32, 64, 16)).toEqual({ x: 7, y: 15 });
  });

  it('clamps to zero when the frame is smaller than the tile size', () => {
    expect(clampAnchor({ x: 4, y: 4 }, 8, 8, 16)).toEqual({ x: 0, y: 0 });
  });
});

describe('deriveFootprint', () => {
  it('returns an empty footprint for a single-cell sprite', () => {
    expect(deriveFootprint(16, 16, 16, { x: 0, y: 0 })).toEqual({
      left: 0,
      up: 0,
      right: 0,
      down: 0,
    });
  });

  it('marks one row above for a bottom-anchored 16x32 tree', () => {
    expect(deriveFootprint(16, 32, 16, { x: 0, y: 16 })).toEqual({
      left: 0,
      up: 1,
      right: 0,
      down: 0,
    });
  });

  it('marks one column each side for a centered 32x32 sprite', () => {
    expect(deriveFootprint(32, 32, 16, { x: 8, y: 16 })).toEqual({
      left: 1,
      up: 1,
      right: 1,
      down: 0,
    });
  });

  it('marks two columns/rows when the anchor is in the far corner', () => {
    expect(deriveFootprint(32, 32, 16, { x: 30, y: 30 })).toEqual({
      left: 2,
      up: 2,
      right: 0,
      down: 0,
    });
  });

  it('marks a 48x48 sprite anchored near the top-left', () => {
    expect(deriveFootprint(48, 48, 16, { x: 16, y: 32 })).toEqual({
      left: 1,
      up: 2,
      right: 1,
      down: 0,
    });
  });
});
