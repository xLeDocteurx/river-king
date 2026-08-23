import { LOSPEC_PALETTES } from './lospec-palettes';

describe('LOSPEC_PALETTES', () => {
  it('exposes the ten curated palettes with unique ids', () => {
    expect(LOSPEC_PALETTES.map((p) => p.id)).toEqual([
      'sweetie-16',
      '33',
      'pico-8',
      'pico-8-secret-palette',
      'slso8',
      'oil-6',
      'twilight-5',
      'slimy-05',
      'nymph-gb',
      '2bit-demiboy',
    ]);
  });

  it('has the expected color counts', () => {
    const counts = Object.fromEntries(LOSPEC_PALETTES.map((p) => [p.id, p.colors.length]));
    expect(counts).toEqual({
      'sweetie-16': 16,
      '33': 33,
      'pico-8': 16,
      'pico-8-secret-palette': 32,
      slso8: 8,
      'oil-6': 6,
      'twilight-5': 5,
      'slimy-05': 5,
      'nymph-gb': 4,
      '2bit-demiboy': 4,
    });
  });

  it('only contains valid lowercase hex colors without #', () => {
    for (const palette of LOSPEC_PALETTES) {
      for (const color of palette.colors) {
        expect(color).toMatch(/^[0-9a-f]{6}$/);
      }
    }
  });

  it('matches the canonical Lospec order for spot-checked palettes', () => {
    const sweetie = LOSPEC_PALETTES.find((p) => p.id === 'sweetie-16')!;
    expect(sweetie.name).toBe('Sweetie 16');
    expect(sweetie.colors.slice(0, 4)).toEqual(['1a1c2c', '5d275d', 'b13e53', 'ef7d57']);
    const pico = LOSPEC_PALETTES.find((p) => p.id === 'pico-8')!;
    expect(pico.name).toBe('PICO-8');
    expect(pico.colors.slice(8, 12)).toEqual(['ff004d', 'ffa300', 'ffec27', '00e436']);
  });
});
