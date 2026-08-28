/**
 * Returns a new tileData grid grown in all four directions by the given
 * padding. The old cells are copied at the `(padLeft, padTop)` offset and all
 * added cells are filled with -1 (empty). The input grid is never mutated.
 * @param tileData - Current scene grid (-1 = empty, >=0 = tile id anchor).
 * @param padLeft - Columns prepended on the left.
 * @param padRight - Columns appended on the right.
 * @param padTop - Rows prepended on the top.
 * @param padBottom - Rows appended on the bottom.
 * @param newWidth - Target width (`tileData[0].length + padLeft + padRight`).
 * @param newHeight - Target height (`tileData.length + padTop + padBottom`).
 * @returns The grown grid of `newHeight × newWidth` cells.
 */
export function growTileData(
  tileData: number[][],
  padLeft: number,
  padRight: number,
  padTop: number,
  padBottom: number,
  newWidth: number,
  newHeight: number,
): number[][] {
  const grown = Array.from({ length: newHeight }, () => Array<number>(newWidth).fill(-1));
  for (let y = 0; y < tileData.length; y++) {
    const row = tileData[y];
    for (let x = 0; x < row.length; x++) {
      grown[y + padTop][x + padLeft] = row[x];
    }
  }
  return grown;
}