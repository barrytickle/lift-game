import type { GameConfig } from '../config';
import { Emitter } from './Emitter';
import { Lift } from './Lift';
import { drawPerks, perkById, type Perk } from './perks';

// Pure game simulation: no Phaser, no rendering. The scene calls update(dt)
// and requestFloor(); views listen to events and read state each frame.

export type PassengerState = 'waiting' | 'riding' | 'gone';

/**
 * Run states (design/game-brief.md, "Lives and walkouts"):
 *   playing --(someone's patience hits 0, lives left)--> walkout
 *   walkout --(breather over and lift back at G)-------> playing
 *   playing --(someone's patience hits 0, last life)---> over
 * A perk draft pauses `playing` without leaving it.
 */
export type RunState = 'playing' | 'walkout' | 'over';

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
  /** `p` ran out of patience on `floor`; everyone in `leavers` (floor null = was riding) leaves too */
  walkout: { p: Passenger; floor: number; livesLeft: number; leavers: { p: Passenger; floor: number | null }[] };
  /** breather over: back to normal play */
  recovered: Record<string, never>;
  arrive: { floor: number };
  /** another floor opened up mid-shift (floors open bottom to top) */
  floorOpen: { floor: number };
  depart: { from: number; to: number };
  /** sim pauses until choosePerk() is called */
  draft: { offer: Perk[] };
  perk: { perk: Perk; level: number };
  gameOver: RunStats;
}

export interface RunStats {
  score: number;
  delivered: number;
  /** seconds on shift, including walkout breathers (draft pauses excluded) */
  time: number;
  /** biggest single drop-off payout */
  bestDelivery: number;
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
  /** floors 0..openFloors-1 are in service; the rest are taped off until the shift opens them */
  openFloors: number;
  /** difficulty clock: stands still during walkouts */
  time = 0;
  /** wall-clock time on shift for the results screen */
  elapsed = 0;
  state: RunState = 'playing';
  bestDelivery = 0;
  /** perk id -> times taken this shift */
  readonly perks: Record<string, number> = {};
  /** non-null while a draft is waiting for the player's pick */
  offer: Perk[] | null = null;

  private nextId = 1;
  private spawnTimer: number;
  private transferTimer = 0;
  private dropsThisStop = 0;
  private nextDraftAt: number;
  /** delivery count when the previous draft came up (0 at the start of a shift) */
  private lastDraftAt = 0;
  private draftsTaken = 0;
  /** floors open when the shift began */
  private readonly firstOpen: number;
  /** seconds of walkout breather left */
  private breather = 0;
  /** seconds left of the eased spawn rate after a walkout */
  private calm = 0;

  constructor(
    readonly cfg: GameConfig,
    private rng: () => number = Math.random,
  ) {
    this.lift = new Lift(cfg.lift);
    this.queues = Array.from({ length: cfg.floors }, () => []);
    this.lives = this.maxLives = cfg.lives;
    this.openFloors = this.firstOpen = Math.max(1, Math.min(cfg.floors, cfg.opening.start));
    this.spawnTimer = cfg.spawn.firstDelay;
    this.nextDraftAt = cfg.draft.first;
  }

  get over(): boolean {
    return this.state === 'over';
  }

  /** Perk "XP" for the HUD bar: deliveries since the last draft, and how many the next draft needs. */
  get draftProgress(): { done: number; need: number } {
    return { done: this.delivered - this.lastDraftAt, need: this.nextDraftAt - this.lastDraftAt };
  }

  /** Player input only counts while playing (not during a walkout or after game over). */
  private get live(): boolean {
    return this.state === 'playing';
  }

  /** Direction of a held ▲/▼, or 0. */
  holding: 0 | 1 | -1 = 0;

  /** Player input: send the lift to a floor. Allowed at any time, even mid-trip. */
  requestFloor(floor: number): void {
    if (!this.live || floor < 0 || floor >= this.openFloors) return;
    this.holding = 0;
    if (floor === this.lift.target) return;
    const from = this.lift.stoppedAt;
    this.lift.target = floor;
    if (from !== null) this.events.emit('depart', { from, to: floor });
  }

  /** Player input: start moving continuously while ▲/▼ is held. */
  hold(dir: 1 | -1): void {
    if (!this.live) return;
    const from = this.lift.stoppedAt;
    this.holding = dir;
    this.lift.hold(dir, this.openFloors);
    if (from !== null && this.lift.target !== from) this.events.emit('depart', { from, to: this.lift.target });
  }

  /** Player input: ▲/▼ let go, so stop at the next floor in that direction. */
  release(): void {
    if (!this.holding) return;
    this.lift.release(this.holding, this.openFloors);
    this.holding = 0;
  }

  update(dt: number): void {
    if (this.state === 'over') return;
    if (this.offer) return; // paused for a perk draft
    this.elapsed += dt;
    if (this.state === 'walkout') {
      this.tickBreather(dt);
      return;
    }
    if (this.delivered >= this.nextDraftAt) {
      this.offer = drawPerks(this.rng, this.cfg.draft.choices, this.perks, this);
      this.events.emit('draft', { offer: this.offer });
      return;
    }
    this.time += dt;
    this.calm = Math.max(0, this.calm - dt);

    this.tickOpening();
    this.tickSpawning(dt);
    this.tickPatience(dt);
    if (this.state !== 'playing') return;

    if (this.lift.update(dt)) {
      this.transferTimer = this.cfg.lift.transferInterval * 0.6; // brief beat as doors open
      this.dropsThisStop = 0;
      this.events.emit('arrive', { floor: this.lift.target });
    }

    const stopped = this.lift.stoppedAt;
    if (stopped !== null) this.tickTransfers(stopped, dt);
  }

  /**
   * Turn the menu demo into a real shift without a cut: the caller restores the
   * live config first, then counters reset and everyone already in the building
   * gets their full patience back.
   */
  startShift(): void {
    this.time = 0;
    this.score = 0;
    this.delivered = 0;
    this.lives = this.maxLives = this.cfg.lives;
    this.state = 'playing';
    this.elapsed = 0;
    this.bestDelivery = 0;
    this.calm = 0;
    this.nextDraftAt = this.cfg.draft.first;
    this.lastDraftAt = 0;
    this.draftsTaken = 0;
    this.spawnTimer = Math.min(this.spawnTimer, this.cfg.spawn.startInterval);
    for (const p of this.passengers.values()) p.patience = p.maxPatience;
  }

  /** Difficulty-clock time at which the next closed floor opens (Infinity once they're all open). */
  get nextOpeningAt(): number {
    if (this.openFloors >= this.cfg.floors) return Infinity;
    return (this.openFloors - this.firstOpen + 1) * this.cfg.opening.every;
  }

  private tickOpening(): void {
    if (this.time < this.nextOpeningAt) return;
    this.events.emit('floorOpen', { floor: this.openFloors++ });
  }

  /** Resolve the pending draft. Ignored if `id` wasn't on offer. */
  choosePerk(id: string): void {
    if (!this.offer?.some((p) => p.id === id)) return;
    const perk = perkById(id)!;
    perk.apply(this);
    const level = (this.perks[id] = (this.perks[id] ?? 0) + 1);
    this.offer = null;
    const { gap, gapGrowth } = this.cfg.draft;
    this.lastDraftAt = this.nextDraftAt;
    this.nextDraftAt += gap + gapGrowth * this.draftsTaken++;
    this.events.emit('perk', { perk, level });
  }

  /**
   * Current spawn interval (before jitter): a linear ramp to minInterval, then
   * "overtime" keeps halving it so no amount of perks lasts forever.
   */
  spawnInterval(): number {
    const { startInterval, minInterval, rampTime, overtimeHalfLife, floorInterval } = this.cfg.spawn;
    // Just after a walkout the interval starts doubled and eases back to normal.
    const ease = 1 + this.calm / this.cfg.walkout.easeIn;
    if (this.time < rampTime) return ease * (startInterval + (minInterval - startInterval) * (this.time / rampTime));
    const overtime = minInterval * Math.pow(0.5, (this.time - rampTime) / overtimeHalfLife);
    return ease * Math.max(floorInterval, overtime);
  }

  /** Newcomers get less patient as the shift ramps up: 1 at the start, latePatience from rampTime on. */
  patienceScale(): number {
    const ramp = Math.min(1, this.time / this.cfg.spawn.rampTime);
    return 1 + (this.cfg.passengers.latePatience - 1) * ramp;
  }

  /** Floors that at least one rider wants to get off at. */
  requestedFloors(): Set<number> {
    const s = new Set<number>();
    for (const id of this.lift.riders) s.add(this.passengers.get(id)!.dest);
    return s;
  }

  /** Floors where stopping does something: a rider gets off, or someone waiting can get on. */
  usefulFloors(): Set<number> {
    const s = this.requestedFloors();
    if (!this.lift.isFull) this.queues.forEach((q, f) => q.length > 0 && s.add(f));
    return s;
  }

  /** Hall calls per floor with people waiting: which way they want to go and how close to walking out (0..1). */
  calls(): { floor: number; up: boolean; down: boolean; urgency: number; count: number }[] {
    const out = [];
    for (let f = 0; f < this.queues.length; f++) {
      const q = this.queues[f].map((id) => this.passengers.get(id)!);
      if (q.length === 0) continue;
      out.push({
        floor: f,
        up: q.some((p) => p.dest > f),
        down: q.some((p) => p.dest < f),
        urgency: Math.max(...q.map((p) => 1 - p.patience / p.maxPatience)),
        count: q.length,
      });
    }
    return out;
  }

  private tickSpawning(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const { jitter } = this.cfg.spawn;
    this.spawnTimer = this.spawnInterval() * (1 + (this.rng() * 2 - 1) * jitter);
    this.spawnPassenger();
  }

  spawnPassenger(origin?: number, dest?: number): Passenger | null {
    const { passengers: pc } = this.cfg;
    const floors = this.openFloors;
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
    const patience = pc.patience * this.patienceScale();
    const p: Passenger = {
      id: this.nextId++,
      origin,
      dest,
      patience,
      maxPatience: patience,
      state: 'waiting',
      look: this.rng(),
    };
    this.passengers.set(p.id, p);
    this.queues[origin].push(p.id);
    this.events.emit('spawn', { p });
    return p;
  }

  private tickPatience(dt: number): void {
    // Everyone loses patience together; if several hit zero on the same tick,
    // the most impatient one starts the walkout and it still costs one life.
    let culprit: { p: Passenger; floor: number } | null = null;
    for (let f = 0; f < this.queues.length; f++) {
      for (const id of this.queues[f]) {
        const p = this.passengers.get(id)!;
        p.patience = Math.max(0, p.patience - dt);
        if (p.patience === 0 && !culprit) culprit = { p, floor: f };
      }
    }
    for (const id of this.lift.riders) {
      const p = this.passengers.get(id)!;
      p.patience = Math.max(0, p.patience - dt * this.cfg.passengers.ridingDrain);
    }
    if (culprit) this.walkout(culprit.p, culprit.floor);
  }

  /**
   * Building-wide walkout: everyone waiting or riding gives up and leaves, one
   * life is lost, and (if any are left) the lift heads home for a breather.
   * Score and deliveries so far are kept.
   */
  private walkout(culprit: Passenger, floor: number): void {
    const leavers: { p: Passenger; floor: number | null }[] = [];
    this.queues.forEach((q, f) => {
      for (const id of q) leavers.push({ p: this.passengers.get(id)!, floor: f });
      q.length = 0;
    });
    for (const id of this.lift.riders) leavers.push({ p: this.passengers.get(id)!, floor: null });
    this.lift.riders.length = 0;
    for (const { p } of leavers) p.state = 'gone';
    this.passengers.clear();
    this.holding = 0;
    this.lift.target = 0;
    this.lives--;
    this.events.emit('walkout', { p: culprit, floor, livesLeft: this.lives, leavers });

    if (this.lives <= 0) {
      this.state = 'over';
      this.events.emit('gameOver', this.stats());
      return;
    }
    this.state = 'walkout';
    this.breather = this.cfg.walkout.breather;
  }

  /** During a walkout: nobody spawns or loses patience while the lift returns to G. */
  private tickBreather(dt: number): void {
    this.breather = Math.max(0, this.breather - dt);
    this.lift.update(dt);
    if (this.breather > 0 || this.lift.stoppedAt !== 0) return;
    this.state = 'playing';
    this.calm = this.cfg.walkout.easeIn;
    this.spawnTimer = this.cfg.walkout.firstSpawn;
    this.events.emit('recovered', {});
  }

  stats(): RunStats {
    return { score: this.score, delivered: this.delivered, time: this.elapsed, bestDelivery: this.bestDelivery };
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
      const { base, patienceBonus, groupBonus, perFloor } = this.cfg.scoring;
      const groupIndex = this.dropsThisStop++;
      const coins =
        base +
        Math.round(patienceBonus * (p.patience / p.maxPatience)) +
        groupBonus * groupIndex +
        perFloor * Math.abs(p.dest - p.origin);
      this.score += coins;
      this.delivered++;
      this.bestDelivery = Math.max(this.bestDelivery, coins);
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
