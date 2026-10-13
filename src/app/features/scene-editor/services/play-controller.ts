import { Injectable, signal } from '@angular/core';
import type { Layer } from '../../../shared/models/scene.model';
import { buildBlockingGrid, resolveCollision, HALF_CELL_HITBOX } from '../collision';
import type { TileFootprintMap } from '../map-footprint';
import { findInteractableTarget } from '../interaction';
import type { InteractionTarget } from '../interaction';
import { runGameAction } from '../../../core/actions/game-actions';

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

/** Maps the facing direction to its normalized movement vector. */
const DIRECTION_VECTORS: Record<PlayerDirection, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/**
 * Holds the runtime player state and movement logic for Play mode.
 *
 * Position is expressed in grid cells (fractional). It tracks which movement
 * keys are currently held via raw window keydown/keyup listeners and applies
 * input to movement in `update(dt)` so playback is frame-rate independent.
 * Interactable tiles are re-targeted after every update; pressing `E` fires
 * the targeted tile's registered action, whose handler owns any feedback.
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
  /** The interactable cell `E` currently targets, or null when out of range. */
  readonly interactionTarget = signal<InteractionTarget | null>(null);

  private readonly held = new Set<string>();
  /** @internal Whether the window input listeners are attached. */
  private listenersActive = false;
  private sceneWidth = 0;
  private sceneHeight = 0;
  private sceneLayers: Layer[] = [];
  private blockingGrid: boolean[][] = [];
  private interactableById = new Map<number, string>();

  /** @internal Records a held key and fires the interaction on an E press. */
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.held.add(event.key.toLowerCase());
    if (event.key.toLowerCase() === 'e' && !event.repeat) {
      this.tryInteract();
    }
  };

  /** @internal Removes a released movement key. */
  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.key.toLowerCase());
  };

  /** @internal Fires the currently targeted tile action, if any. */
  private readonly tryInteract = (): void => {
    const target = this.interactionTarget();
    if (!target) return;
    runGameAction(target.actionId);
  };

  /**
   * Begins a Play session: attaches input listeners, builds the blocking grid
   * from the scene's visible layers, resets the player to the given spawn cell
   * (position signals hold the center, offset by half a cell), and derives the
   * initial interaction target.
   * @param scene - The scene being played, with its width/height bounds and layers.
   * @param spawn - The spawn cell to start at (the player centers on it).
   * @param blockingById - Per-tile blocking flags.
   * @param footprints - Grid-cell footprint per tile id.
   * @param interactableById - Per-tile action id for interactable tiles.
   */
  start(
    scene: { width: number; height: number; layers: Layer[] },
    spawn: { x: number; y: number },
    blockingById: Map<number, boolean>,
    footprints: TileFootprintMap,
    interactableById: Map<number, string>,
  ): void {
    this.sceneWidth = scene.width;
    this.sceneHeight = scene.height;
    this.sceneLayers = scene.layers;
    this.blockingGrid = buildBlockingGrid(
      scene.width,
      scene.height,
      scene.layers,
      blockingById,
      footprints,
    );
    this.interactableById = interactableById;
    this.x.set(spawn.x + 0.5);
    this.y.set(spawn.y + 0.5);
    this.direction.set('down');
    this.moving.set(false);
    this.recomputeInteractionTarget();
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
   * resolving against the blocking grid (out-of-scene cells block). Updates
   * facing direction, the moving state, and re-derives the interaction target.
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

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;

      const resolved = resolveCollision(
        { x: this.x(), y: this.y() },
        { x: dx * this.speed * dt, y: dy * this.speed * dt },
        HALF_CELL_HITBOX,
        this.blockingGrid,
        { width: this.sceneWidth, height: this.sceneHeight },
      );
      this.x.set(resolved.x);
      this.y.set(resolved.y);

      if (Math.abs(dx) >= Math.abs(dy)) {
        this.direction.set(dx < 0 ? 'left' : 'right');
      } else {
        this.direction.set(dy < 0 ? 'up' : 'down');
      }
      this.moving.set(true);
    } else {
      this.moving.set(false);
    }

    this.recomputeInteractionTarget();
  }

  /** @internal Derives the interactable cell from the center cell and direction. */
  private recomputeInteractionTarget(): void {
    this.interactionTarget.set(
      findInteractableTarget(
        { x: Math.floor(this.x()), y: Math.floor(this.y()) },
        DIRECTION_VECTORS[this.direction()],
        this.sceneLayers,
        this.interactableById,
      ),
    );
  }
}
