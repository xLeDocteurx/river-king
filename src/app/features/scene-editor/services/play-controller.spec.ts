import { TestBed } from '@angular/core/testing';
import { PlayerController } from './play-controller';
import { registerGameAction } from '../../../core/actions/game-actions';
import { NotificationService } from '../../../core/services/notification.service';
import type { Layer } from '../../../shared/models/scene.model';

function press(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

function release(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

function emptyScene(
  width: number,
  height: number,
): { width: number; height: number; layers: Layer[] } {
  return { width, height, layers: [] };
}

/** 4x4 scene with a blocking wall on column 2 (rows 0..3), tile id 0. */
function wallScene(): { width: number; height: number; layers: Layer[] } {
  const row = [-1, -1, 0, -1];
  return {
    width: 4,
    height: 4,
    layers: [
      {
        id: 'l1',
        name: 'wall',
        visible: true,
        opacity: 1,
        tileData: [row, [...row], [...row], [...row]],
      },
    ],
  };
}

const WALL = new Map<number, boolean>([[0, true]]);

/** 4x4 scene where the listed cells hold tile id 7. */
function sceneWithBell(cells: [number, number][]): {
  width: number;
  height: number;
  layers: Layer[];
} {
  const tileData = Array.from({ length: 4 }, () => Array<number>(4).fill(-1));
  for (const [x, y] of cells) {
    tileData[y][x] = 7;
  }
  return {
    width: 4,
    height: 4,
    layers: [{ id: 'l1', name: 'interact', visible: true, opacity: 1, tileData }],
  };
}

const BELL = new Map<number, string>([[7, 'bell']]);

describe('PlayerController', () => {
  let player: PlayerController;
  let notification: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PlayerController] });
    player = TestBed.inject(PlayerController);
    notification = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    player.stop();
  });

  it('starts centered on the given spawn cell', () => {
    player.start(emptyScene(10, 10), { x: 3, y: 4 }, new Map(), {}, new Map());
    expect(player.x()).toBe(3.5);
    expect(player.y()).toBe(4.5);
  });

  it('moves up when W is held', () => {
    player.start(emptyScene(10, 10), { x: 5, y: 5 }, new Map(), {}, new Map());
    press('w');
    player.update(1);
    expect(player.x()).toBe(5.5);
    expect(player.y()).toBeLessThan(5.5);
  });

  it('moves right when arrow-right is held', () => {
    player.start(emptyScene(10, 10), { x: 5, y: 5 }, new Map(), {}, new Map());
    press('ArrowRight');
    player.update(1);
    expect(player.x()).toBeGreaterThan(5.5);
    expect(player.y()).toBe(5.5);
  });

  it('normalizes diagonal movement so speed is not boosted', () => {
    player.start(emptyScene(10, 10), { x: 0, y: 0 }, new Map(), {}, new Map());
    player.speed = 1;
    press('d');
    press('s');
    player.update(1);
    expect(player.x()).toBeCloseTo(0.5 + Math.SQRT1_2, 5);
    expect(player.y()).toBeCloseTo(0.5 + Math.SQRT1_2, 5);
  });

  it('scales movement by dt', () => {
    player.start(emptyScene(10, 10), { x: 0, y: 0 }, new Map(), {}, new Map());
    player.speed = 4;
    press('d');
    player.update(0.5);
    expect(player.x()).toBeCloseTo(2.5, 5);
  });

  it('clamps the player inside the scene bounds', () => {
    player.start(emptyScene(10, 10), { x: 0, y: 0 }, new Map(), {}, new Map());
    press('a');
    player.update(100);
    expect(player.x()).toBe(0.25);
  });

  it('sets direction and moving state from input', () => {
    player.start(emptyScene(10, 10), { x: 5, y: 5 }, new Map(), {}, new Map());
    press('a');
    player.update(0.1);
    expect(player.direction()).toBe('left');
    expect(player.moving()).toBe(true);
    release('a');
    player.update(0.1);
    expect(player.moving()).toBe(false);
  });

  it('does not move when no key is held', () => {
    player.start(emptyScene(10, 10), { x: 5, y: 5 }, new Map(), {}, new Map());
    player.update(1);
    expect(player.x()).toBe(5.5);
    expect(player.y()).toBe(5.5);
    expect(player.moving()).toBe(false);
  });

  it('stops when walking into a blocking tile', () => {
    player.start(wallScene(), { x: 1, y: 1 }, WALL, {}, new Map());
    press('d');
    player.update(1);
    expect(player.x()).toBe(1.75);
    expect(player.y()).toBe(1.5);
  });

  it('slides along a blocking wall when moving diagonally', () => {
    player.start(wallScene(), { x: 1, y: 1 }, WALL, {}, new Map());
    press('d');
    press('s');
    player.update(0.5);
    expect(player.x()).toBe(1.75);
    expect(player.y()).toBeCloseTo(1.5 + Math.SQRT1_2 * 5 * 0.5, 3);
  });

  it('fires the facing-tile action on E', () => {
    const handler = vi.fn();
    registerGameAction('bell', handler);
    player.start(sceneWithBell([[2, 2]]), { x: 2, y: 1 }, new Map(), {}, BELL);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    expect(player.interactionTarget()).toEqual({ x: 2, y: 2, actionId: 'bell' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(notification.messages().length).toBe(0);
  });

  it('falls back to the cell under the player when the facing cell is empty', () => {
    const handler = vi.fn();
    registerGameAction('bell', handler);
    player.start(sceneWithBell([[2, 1]]), { x: 2, y: 1 }, new Map(), {}, BELL);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'E' }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(notification.messages().length).toBe(0);
  });

  it('does nothing on E without a target', () => {
    const handler = vi.fn();
    registerGameAction('bell', handler);
    player.start(emptyScene(4, 4), { x: 2, y: 1 }, new Map(), {}, new Map());
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    expect(notification.messages().length).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores repeated E keydown events', () => {
    const handler = vi.fn();
    registerGameAction('bell', handler);
    player.start(sceneWithBell([[2, 2]]), { x: 2, y: 1 }, new Map(), {}, BELL);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', repeat: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('updates the target when the player turns', () => {
    player.start(
      sceneWithBell([
        [1, 1],
        [2, 2],
      ]),
      { x: 2, y: 1 },
      new Map(),
      {},
      BELL,
    );
    expect(player.interactionTarget()).toEqual({ x: 2, y: 2, actionId: 'bell' });
    press('a');
    player.update(0);
    expect(player.interactionTarget()).toEqual({ x: 1, y: 1, actionId: 'bell' });
  });

  it('updates the target when the player moves', () => {
    player.start(sceneWithBell([[2, 3]]), { x: 2, y: 1 }, new Map(), {}, BELL);
    press('s');
    player.update(0.4);
    expect(player.interactionTarget()).toEqual({ x: 2, y: 3, actionId: 'bell' });
  });
});
