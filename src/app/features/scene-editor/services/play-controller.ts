import { Injectable, signal } from '@angular/core';

/** The direction the player is currently facing. */
export type PlayerDirection = 'up' | 'down' | 'left' | 'right';

/** Maps an input key (lowercased) to a normalized movement vector. */
const MOVEMENT_KEYS: Record<string, { dx: number; dy: number }> = {
  w: { dx: 0, dy: -1 },
  arrowup: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  arrowdown: { dx: 0, dy: 1 },
  a: { dx: -1, dy: 0 },
  arrowleft: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 },
  arrowright: { dx: 1, dy: 0 },
};

/**
 * Holds the runtime player state and movement logic for Play mode.
 *
 * Position is expressed in grid cells (fractional). It tracks which movement
 * keys are currently held via raw window keydown/keyup listeners and applies
 * input to movement in `update(dt)` so playback is frame-rate independent.
 */
@Injectable()
export class PlayerController {
  /** Current player X position in grid cells (fractional). */
  readonly x = signal(0);
  /** Current player Y position in grid cells (fractional). */
  readonly y = signal(0);
  /** The direction the player is facing. */
  readonly direction = signal<PlayerDirection>('down');
  /** Whether the player currently has a movement axis held. */
  readonly moving = signal(false);
  /** Movement speed in grid cells per second. */
  speed = 5;

  private readonly held = new Set<string>();
  /** @internal Whether the window input listeners are attached. */
  private listenersActive = false;
  private sceneWidth = 0;
  private sceneHeight = 0;

  /** @internal Records a held movement key. */
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.held.add(event.key.toLowerCase());
  };

  /** @internal Removes a released movement key. */
  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.key.toLowerCase());
  };

  /**
   * Begins a Play session: attaches input listeners, applies bounds, and
   * resets the player to the given spawn cell.
   * @param scene - The scene being played, for its width/height bounds.
   * @param spawn - The spawn cell to start at.
   */
  start(scene: { width: number; height: number }, spawn: { x: number; y: number }): void {
    this.sceneWidth = scene.width;
    this.sceneHeight = scene.height;
    this.x.set(spawn.x);
    this.y.set(spawn.y);
    this.direction.set('down');
    this.moving.set(false);
    this.held.clear();
    if (!this.listenersActive) {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      this.listenersActive = true;
    }
  }

  /**
   * Ends a Play session: releases all held keys and detaches input listeners.
   */
  stop(): void {
    this.held.clear();
    if (this.listenersActive) {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      this.listenersActive = false;
    }
  }

  /**
   * Advances the player by the given delta time, applying held input and
   * clamping to scene bounds. Updates facing direction and the moving state.
   * @param dt - Delta time in seconds.
   */
  update(dt: number): void {
    let dx = 0;
    let dy = 0;
    for (const key of this.held) {
      const m = MOVEMENT_KEYS[key];
      if (m) {
        dx += m.dx;
        dy += m.dy;
      }
    }

    if (dx === 0 && dy === 0) {
      this.moving.set(false);
      return;
    }

    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;

    this.x.update((v) => Math.max(0, Math.min(this.sceneWidth - 1, v + dx * this.speed * dt)));
    this.y.update((v) => Math.max(0, Math.min(this.sceneHeight - 1, v + dy * this.speed * dt)));

    if (Math.abs(dx) >= Math.abs(dy)) {
      this.direction.set(dx < 0 ? 'left' : 'right');
    } else {
      this.direction.set(dy < 0 ? 'up' : 'down');
    }
    this.moving.set(true);
  }
}
