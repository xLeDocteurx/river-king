import {
  GAME_ACTIONS,
  listGameActions,
  runGameAction,
  registerGameAction,
} from './game-actions';

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

  it('registers a new action and runs it', () => {
    const handler = vi.fn();
    registerGameAction('mine', handler);
    runGameAction('mine');
    expect(handler).toHaveBeenCalledTimes(1);
    delete GAME_ACTIONS['mine'];
  });

  it('overwrites an existing action (last registration wins)', () => {
    const first = vi.fn();
    const second = vi.fn();
    registerGameAction('mine', first);
    registerGameAction('mine', second);
    runGameAction('mine');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    delete GAME_ACTIONS['mine'];
  });
});
