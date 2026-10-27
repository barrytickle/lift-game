import type { GameConfig } from '../config';
import { Emitter } from './Emitter';
import { Lift } from './Lift';
import { drawPerks, perkById, type Perk } from './perks';

// Pure game simulation: no Phaser, no rendering. The scene calls update(dt)
// and requestFloor(); views listen to events and read state each frame.

export type PassengerState = 'waiting' | 'riding' | 'gone';

export interface Passenger {
  id: number;
  origin: number;
  dest: number;
  patience: number;
  maxPatience: number;
  state: PassengerState;
  /** cosmetic seed so views can vary colour/shape deterministically */
  look: number;
}

export interface WorldEvents {
  spawn: { p: Passenger };
  board: { p: Passenger; floor: number };
  deliver: { p: Passenger; floor: number; coins: number; groupIndex: number };
  walkout: { p: Passenger; floor: number; livesLeft: number };
  arrive: { floor: number };
  depart: { from: number; to: number };
  /** sim pauses until choosePerk() is called */
  draft: { offer: Perk[] };
  perk: { perk: Perk; level: number };
  gameOver: { score: number; delivered: number; time: number };
}

export class World {
  readonly events = new Emitter<WorldEvents>();
  readonly lift: Lift;
  readonly passengers = new Map<number, Passenger>();
  /** waiting queues per floor, front of queue first */
  readonly queues: number[][];

  score = 0;
  delivered = 0;
  lives: number;
  maxLives: number;
  time = 0;
  over = false;
  /** perk id -> times taken this shift */
  readonly perks: Record<string, number> = {};
  /** non-null while a draft is waiting for the player's pick */
  offer: Perk[] | null = null;

  private nextId = 1;
  private spawnTimer: number;
  private transferTimer = 0;
  private dropsThisStop = 0;
  private nextDraftAt: number;
  private draftsTaken = 0;

  constructor(
    readonly cfg: GameConfig,
    private rng: () => number = Math.random,
  ) {
    this.lift = new Lift(cfg.lift);
    this.queues = Array.from({ length: cfg.floors }, () => []);
    this.lives = this.maxLives = cfg.lives;
    this.spawnTimer = cfg.spawn.firstDelay;
    this.nextDraftAt = cfg.draft.first;
  }

  /** Direction of a held ▲/▼, or 0. */
  holding: 0 | 1 | -1 = 0;

  /** Player input: send the lift to a floor. Allowed at any time, even mid-trip. */
  requestFloor(floor: number): void {
    if (this.over || floor < 0 || floor >= this.cfg.floors) return;
    this.holding = 0;
    if (floor === this.lift.target) return;
    const from = this.lift.stoppedAt;
    this.lift.target = floor;
    if (from !== null) this.events.emit('depart', { from, to: floor });
  }

  /** Player input: start moving continuously while ▲/▼ is held. */
  hold(dir: 1 | -1): void {
    if (this.over) return;
    const from = this.lift.stoppedAt;
    this.holding = dir;
    this.lift.hold(dir, this.cfg.floors);
    if (from !== null && this.lift.target !== from) this.events.emit('depart', { from, to: this.lift.target });
  }

  /** Player input: ▲/▼ let go, so stop at the next floor in that direction. */
  release(): void {
    if (!this.holding) return;
    this.lift.release(this.holding, this.cfg.floors);
    this.holding = 0;
  }

  update(dt: number): void {
    if (this.over) return;
    if (this.offer) return; // paused for a perk draft
    if (this.delivered >= this.nextDraftAt) {
      this.offer = drawPerks(this.rng, this.cfg.draft.choices, this.perks);
      this.events.emit('draft', { offer: this.offer });
      return;
    }
    this.time += dt;

    this.tickSpawning(dt);
    this.tickPatience(dt);
    if (this.over) return;

    if (this.lift.update(dt)) {
      this.transferTimer = this.cfg.lift.transferInterval * 0.6; // brief beat as doors open
      this.dropsThisStop = 0;
      this.events.emit('arrive', { floor: this.lift.target });
    }

    const stopped = this.lift.stoppedAt;
    if (stopped !== null) this.tickTransfers(stopped, dt);
  }

  /** Resolve the pending draft. Ignored if `id` wasn't on offer. */
  choosePerk(id: string): void {
    if (!this.offer?.some((p) => p.id === id)) return;
    const perk = perkById(id)!;
    perk.apply(this);
    const level = (this.perks[id] = (this.perks[id] ?? 0) + 1);
    this.offer = null;
    const { gap, gapGrowth } = this.cfg.draft;
    this.nextDraftAt += gap + gapGrowth * this.draftsTaken++;
    this.events.emit('perk', { perk, level });
  }

  /**
   * Current spawn interval (before jitter): a linear ramp to minInterval, then
   * "overtime" keeps halving it so no amount of perks lasts forever.
   */
  spawnInterval(): number {
    const { startInterval, minInterval, rampTime, overtimeHalfLife, floorInterval } = this.cfg.spawn;
    if (this.time < rampTime) return startInterval + (minInterval - startInterval) * (this.time / rampTime);
    const overtime = minInterval * Math.pow(0.5, (this.time - rampTime) / overtimeHalfLife);
    return Math.max(floorInterval, overtime);
  }

  /** Floors that at least one rider wants to get off at. */
  requestedFloors(): Set<number> {
    const s = new Set<number>();
    for (const id of this.lift.riders) s.add(this.passengers.get(id)!.dest);
    return s;
  }

  private tickSpawning(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const { jitter } = this.cfg.spawn;
    this.spawnTimer = this.spawnInterval() * (1 + (this.rng() * 2 - 1) * jitter);
    this.spawnPassenger();
  }

  spawnPassenger(origin?: number, dest?: number): Passenger | null {
    const { floors, passengers: pc } = this.cfg;
    if (origin === undefined) {
      const open = [...Array(floors).keys()].filter((f) => this.queues[f].length < pc.maxWaitingPerFloor);
      if (open.length === 0) return null;
      // The lobby is busier than the upper floors.
      origin = open.includes(0) && this.rng() < 0.35 ? 0 : open[Math.floor(this.rng() * open.length)];
    }
    if (dest === undefined) {
      dest = Math.floor(this.rng() * (floors - 1));
      if (dest >= origin) dest++;
    }
    const p: Passenger = {
      id: this.nextId++,
      origin,
      dest,
      patience: pc.patience,
      maxPatience: pc.patience,
      state: 'waiting',
      look: this.rng(),
    };
    this.passengers.set(p.id, p);
    this.queues[origin].push(p.id);
    this.events.emit('spawn', { p });
    return p;
  }

  private tickPatience(dt: number): void {
    for (let f = 0; f < this.queues.length; f++) {
      const q = this.queues[f];
      for (let i = q.length - 1; i >= 0; i--) {
        const p = this.passengers.get(q[i])!;
        p.patience -= dt;
        if (p.patience > 0) continue;
        q.splice(i, 1);
        p.patience = 0;
        p.state = 'gone';
        this.passengers.delete(p.id);
        this.lives--;
        this.events.emit('walkout', { p, floor: f, livesLeft: this.lives });
        if (this.lives <= 0) {
          this.over = true;
          this.events.emit('gameOver', { score: this.score, delivered: this.delivered, time: this.time });
          return;
        }
      }
    }
    for (const id of this.lift.riders) {
      const p = this.passengers.get(id)!;
      p.patience = Math.max(0, p.patience - dt * this.cfg.passengers.ridingDrain);
    }
  }

  /** One passenger moves per transferInterval: everyone off first, then boarding. */
  private tickTransfers(floor: number, dt: number): void {
    this.transferTimer -= dt;
    if (this.transferTimer > 0) return;

    const riders = this.lift.riders;
    const exitIdx = riders.findIndex((id) => this.passengers.get(id)!.dest === floor);
    if (exitIdx >= 0) {
      const [id] = riders.splice(exitIdx, 1);
      const p = this.passengers.get(id)!;
      p.state = 'gone';
      this.passengers.delete(id);
      const { base, patienceBonus, groupBonus } = this.cfg.scoring;
      const groupIndex = this.dropsThisStop++;
      const coins = base + Math.round(patienceBonus * (p.patience / p.maxPatience)) + groupBonus * groupIndex;
      this.score += coins;
      this.delivered++;
      this.events.emit('deliver', { p, floor, coins, groupIndex });
      this.transferTimer = this.cfg.lift.transferInterval;
      return;
    }

    const q = this.queues[floor];
    if (q.length > 0 && !this.lift.isFull) {
      const id = q.shift()!;
      const p = this.passengers.get(id)!;
      p.state = 'riding';
      riders.push(id);
      this.events.emit('board', { p, floor });
      this.transferTimer = this.cfg.lift.transferInterval;
      return;
    }
    this.transferTimer = 0;
  }
}
