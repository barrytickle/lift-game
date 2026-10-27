import Phaser from 'phaser';
// Portrait design space: fixed width, height stretched to the device's aspect
// (within limits) so tall phones aren't letterboxed. Phaser's FIT scaler does the
// rest. The canvas is rendered at up to 2x so shapes and text stay crisp.

export const W = 480;
// Measure the game container (index.html keeps it inside the display's safe area), not the whole window.
const box = document.getElementById('game')?.getBoundingClientRect();
const aspect = (box?.height || window.innerHeight) / Math.max(1, box?.width || window.innerWidth);
export const H = Math.round(W * Math.min(2.2, Math.max(1.5, aspect)));
export const DPR = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));

export const HUD_H = 112;
/** Street-level strip under the building holds the lift's control panel. */
export const PANEL_H = 106;
export const GROUND_Y = H - PANEL_H;

/** Floors never get squashed below this; taller towers scroll instead. */
export const MIN_FLOOR_H = 132;
/** ...and never get stretched past this: a short tower leaves night sky above it. */
export const MAX_FLOOR_H = 190;

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export class Layout {
  readonly floorH: number;
  readonly shaftX = 96; // centre of the shaft
  readonly shaftW = 112;
  readonly cabW = 100;
  readonly cabH = 116;
  readonly queueX = 196;
  readonly queueGap = 50;

  constructor(readonly floors: number) {
    this.floorH = Phaser.Math.Clamp((GROUND_Y - HUD_H - 8) / floors, MIN_FLOOR_H, MAX_FLOOR_H);
  }

  /**
   * A tower that scrolls a long way needs a solid HUD backing so rooms don't slide
   * under the counters. One that only overshoots by a few pixels (or fits) shows sky there.
   */
  get scrolls(): boolean {
    return this.minScrollY < -60;
  }

  /** Highest the camera may scroll (negative = up); 0 when the tower fits the screen. */
  get minScrollY(): number {
    return Math.min(0, this.floorY(this.floors) - 30 - HUD_H);
  }

  /** y of the floor surface for a (possibly fractional) floor index */
  floorY(f: number): number {
    return GROUND_Y - f * this.floorH;
  }

  /** floor index for a tap at world y, or null if outside the building */
  floorAt(y: number): number | null {
    if (y < this.floorY(this.floors) || y > GROUND_Y + 24) return null;
    const f = Math.floor((GROUND_Y + 6 - y) / this.floorH);
    return Math.max(0, Math.min(this.floors - 1, f));
  }

  queueSlotX(i: number): number {
    return this.queueX + i * this.queueGap;
  }

  /** Riders huddle around the middle of the cab. */
  riderSlotX(i: number, count: number, capacity: number): number {
    const step = capacity > 1 ? Math.min(24, (this.cabW - 30) / (capacity - 1)) : 0;
    return this.shaftX + (i - (count - 1) / 2) * step;
  }
}

export function floorLabel(f: number): string {
  return f === 0 ? 'G' : String(f);
}
