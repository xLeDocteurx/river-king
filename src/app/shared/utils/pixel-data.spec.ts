import { blankIndices, cropOrPadIndices, encodePixelData, decodePixelData } from './pixel-data';

describe('blankIndices', () => {
  it('creates h rows of w zeros', () => {
    expect(blankIndices(2, 3)).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
  });
});

describe('cropOrPadIndices', () => {
  it('crops keeping the top-left region', () => {
    const src = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    expect(cropOrPadIndices(src, 2, 2)).toEqual([
      [1, 2],
      [4, 5],
    ]);
  });

  it('pads with zeros when growing', () => {
    expect(cropOrPadIndices([[1]], 2, 2)).toEqual([
      [1, 0],
      [0, 0],
    ]);
  });

  it('handles empty source', () => {
    expect(cropOrPadIndices([], 2, 2)).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });
});

describe('encodePixelData', () => {
  it('encodes pixel data from palette indices', () => {
    const paletteIndices = [
      [0, 1, 0],
      [1, 0, 1],
      [0, 0, 0],
    ];
    const palette = ['#ff0000', '#00ff00'];
    const pixelData = encodePixelData(paletteIndices, palette);
    expect(pixelData.startsWith('data:image/png;base64,')).toBe(true);
  });
});

describe('decodePixelData', () => {
  it('decodes palette indices from pixel data', async () => {
    const palette = ['#ff0000', '#00ff00'];
    // Use the hardcoded blank data URL which triggers fallback in jsdom
    const pixelData = 'data:image/png;base64,';
    const decoded = await decodePixelData(pixelData, palette, 3, 3);
    expect(decoded).toHaveLength(3);
    expect(decoded[0]).toEqual([0, 0, 0]);
  });

  it('decodes blank pixel data when invalid', async () => {
    const decoded = await decodePixelData('', ['#ff0000'], 2, 2);
    expect(decoded).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });
});
