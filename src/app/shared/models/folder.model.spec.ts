import { describe, expect, it } from 'vitest';
import { computeCollapsedKeys, FOLDER_FOLD_THRESHOLD } from './folder.model';

describe('computeCollapsedKeys', () => {
  const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const six = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('collapses every folder by default when top-level count exceeds the threshold', () => {
    expect(computeCollapsedKeys([], seven)).toEqual(seven);
  });

  it('leaves everything expanded at or below the threshold', () => {
    expect(computeCollapsedKeys([], six)).toEqual([]);
  });

  it('never folds the ungrouped root', () => {
    const paths = ['', ...seven];
    expect(computeCollapsedKeys([], paths)).toEqual(seven);
  });

  it('keeps touched folders (lastOpenedAt > 0) expanded above the threshold', () => {
    const rows = [{ path: 'a', collapsed: false, lastOpenedAt: 123 }];
    expect(computeCollapsedKeys(rows, seven)).not.toContain('a');
    expect(computeCollapsedKeys(rows, seven)).toContain('b');
  });

  it('explicit collapsed state wins even below the threshold', () => {
    const rows = [{ path: 'c', collapsed: true, lastOpenedAt: 0 }];
    expect(computeCollapsedKeys(rows, six)).toEqual(['c']);
  });

  it('explicit collapsed state wins over a recent lastOpenedAt', () => {
    const rows = [{ path: 'a', collapsed: true, lastOpenedAt: 999 }];
    expect(computeCollapsedKeys(rows, seven)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('counts distinct top-level segments, so nested keys do not inflate the count', () => {
    // 6 distinct top-levels ('props','forest','mountain','swamp','town','castle') -> not > 6 -> expanded
    const paths = ['props', 'forest/caves', 'mountain/lava', 'swamp', 'town', 'castle'];
    expect(computeCollapsedKeys([], paths)).toEqual([]);
  });

  it('exposes the default threshold constant', () => {
    expect(FOLDER_FOLD_THRESHOLD).toBe(6);
  });
});
