import { gridStrokeColor } from './grid-color';

describe('gridStrokeColor', () => {
  it('returns the theme --border token when available', () => {
    const element = document.createElement('div');
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (prop: string) => (prop === '--border' ? ' #abcdef ' : ''),
    } as unknown as CSSStyleDeclaration);

    expect(gridStrokeColor(element)).toBe('#abcdef');

    vi.mocked(window.getComputedStyle).mockRestore();
  });

  it('falls back to a neutral gray when the token is missing', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    expect(gridStrokeColor(element)).toBe('rgba(127, 127, 127, 0.35)');

    element.remove();
  });
});
