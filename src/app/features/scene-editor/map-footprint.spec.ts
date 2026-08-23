import { clearOverlappedAnchors, getFootprint } from './map-footprint';

describe('getFootprint', () => {
  it('defaults to a 1x1 footprint when the tile has no entry', () => {
    expect(getFootprint(7, {})).toEqual({ w: 1, h: 1 });
  });

  it('returns the stored footprint for a known tile', () => {
    expect(getFootprint(7, { 7: { w: 2, h: 3 } })).toEqual({ w: 2, h: 3 });
  });
});

describe('clearOverlappedAnchors', () => {
  const footprints = { 1: { w: 2, h: 2 }, 9: { w: 1, h: 1 } };

  it('removes only anchors whose footprint intersects the rectangle', () => {
    const tileData = [
      [1, -1, -1],
      [-1, -1, 9],
      [-1, -1, -1],
    ];

    const result = clearOverlappedAnchors(tileData, 1, 1, 2, 1, footprints);

    // Tile 1 anchored at (0,0) spans cells x 0..1 / y 0..1 -> shares (1,1).
    expect(result[0][0]).toBe(-1);
    // Tile 9 anchored at (2,1) sits inside the rectangle x 1..2 / y 1..1.
    expect(result[1][2]).toBe(-1);
  });

  it('keeps anchors outside the rectangle', () => {
    const tileData = [
      [-1, -1, -1],
      [-1, -1, -1],
      [-1, -1, 9],
    ];

    const result = clearOverlappedAnchors(tileData, 0, 0, 2, 2, footprints);

    expect(result[2][2]).toBe(9);
  });

  it('does not mutate the input array', () => {
    const tileData = [
      [1, -1],
      [-1, 9],
    ];

    clearOverlappedAnchors(tileData, 0, 0, 2, 2, footprints);

    expect(tileData[0][0]).toBe(1);
    expect(tileData[1][1]).toBe(9);
  });
});
