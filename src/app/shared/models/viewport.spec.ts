import { describe, it, expect } from 'vitest';
import { DEFAULT_VIEW_HEIGHT, DEFAULT_VIEW_WIDTH, VIEW_PRESETS, resolveViewport } from './viewport';

describe('viewport', () => {
  it('defaults to a 16:9 resolution', () => {
    expect(DEFAULT_VIEW_WIDTH).toBe(256);
    expect(DEFAULT_VIEW_HEIGHT).toBe(144);
    expect(DEFAULT_VIEW_WIDTH / DEFAULT_VIEW_HEIGHT).toBeCloseTo(16 / 9, 2);
  });

  it('exposes the four presets in order', () => {
    expect(VIEW_PRESETS.map((p) => [p.width, p.height])).toEqual([
      [256, 144],
      [320, 180],
      [384, 216],
      [256, 224],
    ]);
  });

  it('resolves explicit dimensions', () => {
    expect(resolveViewport({ viewWidth: 320, viewHeight: 180 })).toEqual({
      width: 320,
      height: 180,
    });
  });

  it('falls back to the default when dimensions are absent', () => {
    expect(resolveViewport({})).toEqual({ width: 256, height: 144 });
  });

  it('falls back to the default for zero or negative dimensions', () => {
    expect(resolveViewport({ viewWidth: 0, viewHeight: -5 })).toEqual({ width: 256, height: 144 });
  });
});
