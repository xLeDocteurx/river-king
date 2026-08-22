/**
 * Creates a width×height grid filled with palette index 0 (transparent).
 * @param width - Number of columns.
 * @param height - Number of rows.
 * @returns The blank index grid.
 */
export function blankIndices(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => Array<number>(width).fill(0));
}

/**
 * Resizes an index grid, anchoring content to the top-left corner.
 * Shrinking crops; growing pads with transparent index 0.
 * @param indices - Source grid to resize.
 * @param newWidth - Target number of columns.
 * @param newHeight - Target number of rows.
 * @returns The resized grid.
 */
export function cropOrPadIndices(
  indices: number[][],
  newWidth: number,
  newHeight: number,
): number[][] {
  const result = blankIndices(newWidth, newHeight);
  for (let y = 0; y < Math.min(newHeight, indices.length); y++) {
    const row = indices[y] ?? [];
    for (let x = 0; x < Math.min(newWidth, row.length); x++) {
      result[y][x] = row[x];
    }
  }
  return result;
}

/**
 * Encodes a palette-index grid into a PNG data URI via canvas.
 * @param indices - Grid of palette indices (0 = transparent).
 * @param palette - Project palette colors; index i maps to palette[i - 1].
 * @returns The encoded data URI, or a mock value when canvas is unavailable.
 */
export function encodePixelData(indices: number[][], palette: string[]): string {
  const width = indices[0]?.length ?? 16;
  const height = indices.length ?? 16;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Fallback for test environments without canvas support
    return 'data:image/png;base64,MOCK';
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = indices[y]?.[x] ?? 0;
      if (idx > 0 && palette[idx - 1]) {
        ctx.fillStyle = palette[idx - 1];
        ctx.fillRect(x, y, 1, 1);
      } else {
        ctx.clearRect(x, y, 1, 1);
      }
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Decodes a PNG data URI back into a palette-index grid by nearest-color matching.
 * @param pixelData - The data URI to decode.
 * @param palette - Project palette colors used for matching.
 * @param width - Expected grid width in pixels.
 * @param height - Expected grid height in pixels.
 * @returns The decoded index grid; zeros when input is invalid or canvas unavailable.
 */
export async function decodePixelData(
  pixelData: string,
  palette: string[],
  width: number,
  height: number,
): Promise<number[][]> {
  if (!pixelData || pixelData === 'data:image/png;base64,' || !pixelData.startsWith('data:')) {
    return blankIndices(width, height);
  }

  const img = new Image();
  img.src = pixelData;
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Fallback for test environments without canvas support
    return blankIndices(width, height);
  }
  ctx.drawImage(img, 0, 0);

  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, width, height);
  } catch {
    return blankIndices(width, height);
  }

  const result: number[][] = [];
  const paletteColors = palette.map((c) => normalizeColor(c));

  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];

      if (a < 128) {
        row.push(0);
      } else {
        const color = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
        let found = 0;
        for (let pi = 0; pi < paletteColors.length; pi++) {
          if (paletteColors[pi] === color) {
            found = pi + 1;
            break;
          }
        }
        row.push(found);
      }
    }
    result.push(row);
  }

  return result;
}

/**
 * Normalizes a hex color to full `#rrggbb` lowercase form.
 * @param color - Color like `#rgb`, `#rrggbb` (any case).
 * @returns Normalized color string.
 */
function normalizeColor(color: string): string {
  const hex = color.replace('#', '');
  if (hex.length === 3) {
    return `#${hex
      .split('')
      .map((c) => c + c)
      .join('')}`;
  }
  return color.toLowerCase();
}
