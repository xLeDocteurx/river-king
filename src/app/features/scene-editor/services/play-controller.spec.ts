import { TestBed } from '@angular/core/testing';
import { PlayerController } from './play-controller';
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

describe('PlayerController', () => {
  let player: PlayerController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PlayerController] });
    player = TestBed.inject(PlayerController);
  });

  afterEach(() => {
    player.stop();
  });

  it('starts centered on the given spawn cell', () => {
    player.start(emptyScene(10, 10), { x: 3, y: 4 }, new Map(), {});
    expect(player.x()).toBe(3.5);
    expect(player.y()).toBe(4.5);
  });

  it('moves up when W is held', () => {
    player.start(emptyScene(10, 10), { x: 5, y: 5 }, new Map(), {});
    press('w');
    player.update(1);
    expect(player.x()).toBe(5.5);
    expect(player.y()).toBeLessThan(5.5);
  });

  it('moves right when arrow-right is held', () => {
    player.start(emptyScene(10, 10), { x: 5, y: 5 }, new Map(), {});
    press('ArrowRight');
    player.update(1);
    expect(player.x()).toBeGreaterThan(5.5);
    expect(player.y()).toBe(5.5);
  });

  it('normalizes diagonal movement so speed is not boosted', () => {
    player.start(emptyScene(10, 10), { x: 0, y: 0 }, new Map(), {});
    player.speed = 1;
    press('d');
    press('s');
    player.update(1);
    expect(player.x()).toBeCloseTo(0.5 + Math.SQRT1_2, 5);
    expect(player.y()).toBeCloseTo(0.5 + Math.SQRT1_2, 5);
  });

  it('scales movement by dt', () => {
    player.start(emptyScene(10, 10), { x: 0, y: 0 }, new Map(), {});
    player.speed = 4;
    press('d');
    player.update(0.5); // half a second -> 2 cells from the centered start (2.5)
    expect(player.x()).toBeCloseTo(2.5, 5);
  });

  it('clamps the player inside the scene bounds', () => {
    player.start(emptyScene(10, 10), { x: 0, y: 0 }, new Map(), {});
    press('a');
    player.update(100);
    expect(player.x()).toBe(0.25);
  });

  it('sets direction and moving state from input', () => {
    player.start(emptyScene(10, 10), { x: 5, y: 5 }, new Map(), {});
    press('a');
    player.update(0.1);
    expect(player.direction()).toBe('left');
    expect(player.moving()).toBe(true);
    release('a');
    player.update(0.1);
    expect(player.moving()).toBe(false);
  });

  it('does not move when no key is held', () => {
    player.start(emptyScene(10, 10), { x: 5, y: 5 }, new Map(), {});
    player.update(1);
    expect(player.x()).toBe(5.5);
    expect(player.y()).toBe(5.5);
    expect(player.moving()).toBe(false);
  });

  it('stops when walking into a blocking tile', () => {
    player.start(wallScene(), { x: 1, y: 1 }, WALL, {});
    press('d');
    player.update(1);
    expect(player.x()).toBe(1.75);
    expect(player.y()).toBe(1.5);
  });

  it('slides along a blocking wall when moving diagonally', () => {
    player.start(wallScene(), { x: 1, y: 1 }, WALL, {});
    press('d');
    press('s');
    player.update(0.5);
    expect(player.x()).toBe(1.75);
    expect(player.y()).toBeCloseTo(1.5 + Math.SQRT1_2 * 5 * 0.5, 3);
  });
});
