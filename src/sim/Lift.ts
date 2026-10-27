import type { GameConfig } from '../config';

/**
 * Lift motion. Position is measured in floors (0 = ground, can be fractional).
 * Velocity eases toward the speed that still lets it brake in time, so the cab
 * accelerates, cruises and settles onto the floor without overshooting, and
 * can be retargeted mid-flight.
 */
export class Lift {
  position = 0;
  velocity = 0;
  target = 0;
  readonly riders: number[] = []; // passenger ids, boarding order

  constructor(private cfg: GameConfig['lift']) {}

  get capacity(): number {
    return this.cfg.capacity;
  }

  get isFull(): boolean {
    return this.riders.length >= this.cfg.capacity;
  }

  /** Floor the cab is resting at, or null while travelling. */
  get stoppedAt(): number | null {
    return this.position === this.target && this.velocity === 0 ? this.target : null;
  }

  /** Held ▲/▼: head for the end of the shaft, passing floors without stopping. */
  hold(dir: 1 | -1, floors: number): void {
    this.target = dir > 0 ? floors - 1 : 0;
  }

  /**
   * Let go: stop at the first floor ahead that the cab can still brake for.
   * From rest (a quick tap) that's simply the next floor in that direction.
   */
  release(dir: 1 | -1, floors: number): void {
    const stopDist = (this.velocity * this.velocity) / (2 * this.cfg.accel);
    const eps = 1e-6;
    const next = dir > 0 ? Math.ceil(this.position + stopDist + eps) : Math.floor(this.position - stopDist - eps);
    this.target = Math.max(0, Math.min(floors - 1, next));
  }

  update(dt: number): boolean {
    const d = this.target - this.position;
    if (d === 0 && this.velocity === 0) return false;

    const { maxSpeed, accel } = this.cfg;
    const brakeSpeed = Math.sqrt(2 * accel * Math.abs(d));
    const desired = Math.sign(d) * Math.min(maxSpeed, brakeSpeed);
    const dv = desired - this.velocity;
    const step = accel * dt;
    this.velocity += Math.abs(dv) <= step ? dv : Math.sign(dv) * step;
    this.position += this.velocity * dt;

    // Snap on arrival (or if we stepped past the target this frame).
    const after = this.target - this.position;
    if (Math.abs(after) < 0.004 || Math.sign(after) !== Math.sign(d)) {
      this.position = this.target;
      this.velocity = 0;
      return true; // arrived this frame
    }
    return false;
  }
}
