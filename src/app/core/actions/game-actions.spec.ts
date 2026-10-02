import { GAME_ACTIONS, listGameActions, runGameAction } from './game-actions';

describe('game-actions', () => {
  it('exposes the test action', () => {
    expect(listGameActions()).toContain('test');
    expect(typeof GAME_ACTIONS['test']).toBe('function');
  });

  it('runs a known action without alerting', () => {
    expect(() => runGameAction('test')).not.toThrow();
  });

  it('no-ops on unknown action id', () => {
    expect(() => runGameAction('does-not-exist')).not.toThrow();
  });
});
