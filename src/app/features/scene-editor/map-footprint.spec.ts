import { clearOverlappedAnchors, footprintRect, getFootprint } from './map-footprint';

describe('getFootprint', () => {
  it('defaults to an empty footprint when the tile has no entry', () => {
    expect(getFootprint(7, {})).toEqual({ left: 0, up: 0, right: 0, down: 0 });
  });

  it('returns the stored footprint for a known tile', () => {
    expect(getFootprint(7, { 7: { left: 1, up: 2, right: 1, down: 0 } })).toEqual({
      left: 1,
      up: 2,
      right: 1,
      down: 0,
    });
  });
});

describe('footprintRect', () => {
  const footprints = {
    1: { left: 0, up: 0, right: 1, down: 1 },
    2: { left: 0, up: 1, right: 0, down: 0 },
  };

  it('extends down-right for a bottom-right footprint', () => {
    expect(footprintRect(2, 1, 1, footprints)).toEqual({ x: 2, y: 1, w: 2, h: 2 });
  });

  it('extends upward for a bottom-anchored tile', () => {
    expect(footprintRect(1, 1, 2, footprints)).toEqual({ x: 1, y: 0, w: 1, h: 2 });
  });

  it('returns a single cell for an unknown tile', () => {
    expect(footprintRect(3, 4, 99, footprints)).toEqual({ x: 3, y: 4, w: 1, h: 1 });
  });
});

describe('clearOverlappedAnchors', () => {
  const footprints = {
    1: { left: 0, up: 0, right: 1, down: 1 },
    9: { left: 0, up: 0, right: 0, down: 0 },
  };

  it('removes only anchors whose footprint intersects the rectangle', () => {
    const tileData = [
      [1, -1, -1],
      [-1, -1, 9],
      [-1, -1, -1],
    ];

    const result = clearOverlappedAnchors(tileData, 1, 1, 2, 1, footprints);

    expect(result[0][0]).toBe(-1);
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

  it('keeps a multi-cell anchor that only touches the rectangle edge', () => {
    const tileData = [
      [1, -1, -1],
      [-1, -1, -1],
      [-1, -1, -1],
    ];

    const result = clearOverlappedAnchors(tileData, 2, 0, 1, 2, footprints);

    expect(result[0][0]).toBe(1);
  });

  it('clears an upward-overhanging anchor whose body reaches the rectangle', () => {
    const overhang = { 2: { left: 0, up: 1, right: 0, down: 0 } };
    const tileData = [
      [-1, -1],
      [-1, 2],
    ];

    // Tile 2 anchored at (1,1) overhangs into (1,0); a rect covering (1,0) hits the body.
    const result = clearOverlappedAnchors(tileData, 1, 0, 1, 1, overhang);

    expect(result[1][1]).toBe(-1);
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
