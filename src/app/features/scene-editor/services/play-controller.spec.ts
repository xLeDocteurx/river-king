import { TestBed } from '@angular/core/testing';
import { PlayerController } from './play-controller';

function press(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

function release(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

describe('PlayerController', () => {
  let player: PlayerController;
  const scene = { width: 10, height: 10 };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PlayerController] });
    player = TestBed.inject(PlayerController);
  });

  afterEach(() => {
    player.stop();
  });

  it('starts at the given spawn position', () => {
    player.start(scene, { x: 3, y: 4 });
    expect(player.x()).toBe(3);
    expect(player.y()).toBe(4);
  });

  it('moves up when W is held', () => {
    player.start(scene, { x: 5, y: 5 });
    press('w');
    player.update(1);
    expect(player.x()).toBe(5);
    expect(player.y()).toBeLessThan(5);
  });

  it('moves right when arrow-right is held', () => {
    player.start(scene, { x: 5, y: 5 });
    press('ArrowRight');
    player.update(1);
    expect(player.x()).toBeGreaterThan(5);
    expect(player.y()).toBe(5);
  });

  it('normalizes diagonal movement so speed is not boosted', () => {
    player.start(scene, { x: 0, y: 0 });
    player.speed = 1;
    press('d');
    press('s');
    player.update(1);
    // Diagonal = one unit of distance, split across axes.
    const expected = Math.SQRT1_2;
    expect(player.x()).toBeCloseTo(expected, 5);
    expect(player.y()).toBeCloseTo(expected, 5);
  });

  it('scales movement by dt', () => {
    player.start(scene, { x: 0, y: 0 });
    player.speed = 4;
    press('d');
    player.update(0.5); // half a second -> 2 cells
    expect(player.x()).toBeCloseTo(2, 5);
  });

  it('clamps the player inside the scene bounds', () => {
    player.start(scene, { x: 0, y: 0 });
    press('a');
    player.update(100);
    expect(player.x()).toBe(0);
  });

  it('sets direction and moving state from input', () => {
    player.start(scene, { x: 5, y: 5 });
    press('a');
    player.update(0.1);
    expect(player.direction()).toBe('left');
    expect(player.moving()).toBe(true);
    release('a');
    player.update(0.1);
    expect(player.moving()).toBe(false);
  });

  it('does not move when no key is held', () => {
    player.start(scene, { x: 5, y: 5 });
    player.update(1);
    expect(player.x()).toBe(5);
    expect(player.y()).toBe(5);
    expect(player.moving()).toBe(false);
  });
});
