// Portrait design space: fixed width, height stretched to the device's aspect
// (within limits) so tall phones aren't letterboxed. Phaser's FIT scaler does the
// rest. The canvas is rendered at up to 2x so shapes and text stay crisp.

export const W = 480;
const aspect = window.innerHeight / Math.max(1, window.innerWidth);
export const H = Math.round(W * Math.min(2.2, Math.max(1.5, aspect)));
export const DPR = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));

export const HUD_H = 112;
/** Street-level strip under the building holds the lift's control panel. */
export const PANEL_H = 106;
export const GROUND_Y = H - PANEL_H;

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
    this.floorH = (GROUND_Y - HUD_H - 8) / floors;
  }

  /** y of the floor surface for a (possibly fractional) floor index */
  floorY(f: number): number {
    return GROUND_Y - f * this.floorH;
  }

  /** floor index for a tap, or null if outside the building */
  floorAt(y: number): number | null {
    if (y < HUD_H || y > GROUND_Y + 24) return null;
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
