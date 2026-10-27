import type { World } from './World';

/**
 * A greedy lift operator. Drives the main-menu demo and the balance bot.
 * When the cab is idle at a floor it scores every other floor by riders to drop
 * off plus waiting people (weighted by how impatient they are), discounted by
 * distance, and heads for the best one.
 */
export class Autopilot {
  private wait = 0;

  /**
   * @param reaction seconds of idle before choosing a floor (human-ish delay)
   * @param skill 1 = always picks the best floor, 0 = mostly random
   */
  constructor(
    private reaction = 0.3,
    private skill = 1,
    private rng: () => number = Math.random,
  ) {}

  update(w: World, dt: number): void {
    const at = w.lift.stoppedAt;
    if (at === null || w.state !== 'playing' || w.offer) return;
    const busy =
      w.lift.riders.some((id) => w.passengers.get(id)!.dest === at) || (w.queues[at].length > 0 && !w.lift.isFull);
    if (busy) {
      this.wait = 0;
      return;
    }
    this.wait += dt;
    if (this.wait < this.reaction) return;
    this.wait = 0;

    let best = -1;
    let bestScore = 0;
    for (let f = 0; f < w.openFloors; f++) {
      if (f === at) continue;
      const drop = w.lift.riders.filter((id) => w.passengers.get(id)!.dest === f).length;
      const room = w.lift.capacity - w.lift.riders.length + drop;
      const urgency = w.queues[f]
        .slice(0, room)
        .map((id) => w.passengers.get(id)!)
        .reduce((s, p) => s + 1 + 3 * (1 - p.patience / p.maxPatience), 0);
      const noise = (this.rng() - 0.5) * (1 - this.skill) * 6;
      const s = (drop * 2 + urgency) / (1 + Math.abs(f - at) * 0.5) + noise;
      if (s > bestScore) {
        bestScore = s;
        best = f;
      }
    }
    if (best >= 0) w.requestFloor(best);
  }
}
