import { vi } from 'vitest';
import { GAME_ACTIONS, listGameActions, runGameAction } from './game-actions';

describe('game-actions', () => {
  it('exposes the test action', () => {
    expect(listGameActions()).toContain('test');
    expect(typeof GAME_ACTIONS['test']).toBe('function');
  });

  it('runs a known action', () => {
    const spy = vi.spyOn(window, 'alert').mockImplementation(() => {
      // no-op
    });
    runGameAction('test');
    expect(spy).toHaveBeenCalledWith('alert');
    spy.mockRestore();
  });

  it('no-ops on unknown action id', () => {
    expect(() => runGameAction('does-not-exist')).not.toThrow();
  });
});
