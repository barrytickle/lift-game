import { describe, expect, it } from 'vitest';
import { cloneConfig, DEFAULT_CONFIG, type GameConfig } from '../src/config';
import { World } from '../src/sim/World';

// A fixed 5-floor test tower with a brisk lift, so these tests cover the rules
// rather than the current tuning (which starts smaller and slower).
const BASE: GameConfig = {
  ...DEFAULT_CONFIG,
  floors: 5,
  lift: { ...DEFAULT_CONFIG.lift, maxSpeed: 3.4, accel: 10 },
  passengers: { ...DEFAULT_CONFIG.passengers, latePatience: 1 },
  opening: { start: Infinity, every: 20 },
};

// No random spawning in these tests: spawns are placed by hand.
function makeWorld(overrides: Partial<GameConfig> = {}): World {
  const cfg: GameConfig = {
    ...BASE,
    spawn: { ...BASE.spawn, firstDelay: 1e9 },
    ...overrides,
  };
  return new World(cfg, () => 0.5);
}

function run(w: World, seconds: number, dt = 1 / 60): void {
  for (let t = 0; t < seconds; t += dt) w.update(dt);
}

describe('lift movement', () => {
  it('travels to the requested floor and stops exactly on it', () => {
    const w = makeWorld();
    w.requestFloor(4);
    run(w, 3);
    expect(w.lift.position).toBe(4);
    expect(w.lift.stoppedAt).toBe(4);
  });

  it('can be retargeted mid-trip without overshooting the new floor', () => {
    const w = makeWorld();
    w.requestFloor(4);
    run(w, 0.4);
    w.requestFloor(1);
    let maxPos = 0;
    for (let i = 0; i < 300; i++) {
      w.update(1 / 60);
      maxPos = Math.max(maxPos, w.lift.position);
    }
    expect(w.lift.stoppedAt).toBe(1);
    expect(maxPos).toBeLessThan(4);
  });

  it('ignores out-of-range floors', () => {
    const w = makeWorld();
    w.requestFloor(9);
    w.requestFloor(-1);
    expect(w.lift.target).toBe(0);
  });
});

describe('boarding and delivery', () => {
  it('boards a waiting passenger, then delivers them for coins', () => {
    const w = makeWorld();
    const p = w.spawnPassenger(0, 3)!;
    run(w, 0.5);
    expect(p.state).toBe('riding');
    expect(w.queues[0]).toHaveLength(0);

    w.requestFloor(3);
    run(w, 3);
    expect(p.state).toBe('gone');
    expect(w.delivered).toBe(1);
    expect(w.score).toBeGreaterThan(DEFAULT_CONFIG.scoring.base);
  });

  it('never boards more than capacity', () => {
    const w = makeWorld({ lift: { ...BASE.lift, capacity: 4 } });
    for (let i = 0; i < 6; i++) w.spawnPassenger(0, 2);
    run(w, 2);
    expect(w.lift.riders).toHaveLength(4);
    expect(w.queues[0]).toHaveLength(2);
  });

  it('lets riders off before new passengers board', () => {
    const w = makeWorld({ lift: { ...BASE.lift, capacity: 4 } });
    for (let i = 0; i < 4; i++) w.spawnPassenger(0, 2);
    run(w, 1);
    expect(w.lift.isFull).toBe(true);
    w.spawnPassenger(2, 0);
    const order: string[] = [];
    w.events.on('deliver', () => order.push('off'));
    w.events.on('board', () => order.push('on'));
    w.requestFloor(2);
    run(w, 3);
    expect(order).toEqual(['off', 'off', 'off', 'off', 'on']);
  });

  it('pays a growing group bonus for drop-offs at the same stop', () => {
    const w = makeWorld({ lift: { ...BASE.lift, capacity: 4 } });
    w.spawnPassenger(0, 1);
    w.spawnPassenger(0, 1);
    run(w, 1);
    const drops: { coins: number; groupIndex: number }[] = [];
    w.events.on('deliver', (e) => drops.push(e));
    w.requestFloor(1);
    run(w, 2);
    expect(drops.map((d) => d.groupIndex)).toEqual([0, 1]);
    // Patience bonus may differ by a rounding coin; the group bonus dominates.
    expect(drops[1].coins - drops[0].coins).toBeGreaterThanOrEqual(DEFAULT_CONFIG.scoring.groupBonus - 1);
  });
});

describe('scoring', () => {
  it('pays more for longer trips', () => {
    const w = makeWorld();
    const coins: number[] = [];
    w.events.on('deliver', (e) => coins.push(e.coins));
    for (const dest of [1, 4]) {
      w.requestFloor(0);
      run(w, 3);
      w.spawnPassenger(0, dest);
      run(w, 0.5);
      w.requestFloor(dest);
      run(w, 3);
    }
    // Patience bonus can differ by a coin or two; the per-floor bonus dominates.
    expect(coins[1] - coins[0]).toBeGreaterThanOrEqual(3 * BASE.scoring.perFloor - 2);
  });
});

describe('starting cab', () => {
  it('seats one passenger at a time until upgraded', () => {
    const w = makeWorld();
    w.spawnPassenger(0, 2);
    w.spawnPassenger(0, 3);
    run(w, 1);
    expect(w.lift.riders).toHaveLength(1);
    expect(w.queues[0]).toHaveLength(1);
  });
});

describe('lift hints', () => {
  it('useful floors are drop-offs, plus pickups only while there is a free seat', () => {
    const w = makeWorld();
    w.spawnPassenger(0, 3);
    run(w, 0.5);
    w.spawnPassenger(2, 4);
    expect([...w.usefulFloors()]).toEqual([3]); // cab full: floor 2 can't board
    w.requestFloor(3);
    run(w, 3);
    expect([...w.usefulFloors()]).toEqual([2]);
  });

  it('calls report direction, head count and the most impatient waiter', () => {
    const w = makeWorld();
    w.requestFloor(4);
    run(w, 2);
    w.spawnPassenger(2, 4);
    run(w, 5);
    w.spawnPassenger(2, 0);
    const [c] = w.calls();
    expect(c).toMatchObject({ floor: 2, up: true, down: true, count: 2 });
    expect(c.urgency).toBeCloseTo(5 / DEFAULT_CONFIG.passengers.patience, 1);
  });
});

describe('patience', () => {
  it('a passenger left waiting walks out and costs a life', () => {
    const w = makeWorld();
    w.requestFloor(4);
    run(w, 2);
    w.spawnPassenger(0, 2);
    run(w, DEFAULT_CONFIG.passengers.patience + 0.1);
    expect(w.queues[0]).toHaveLength(0);
    expect(w.lives).toBe(DEFAULT_CONFIG.lives - 1);
  });

  it('riders never walk out, their patience just bottoms out', () => {
    const w = makeWorld();
    const p = w.spawnPassenger(0, 4)!;
    run(w, 0.5);
    run(w, 200);
    expect(p.state).toBe('riding');
    expect(p.patience).toBe(0);
    expect(w.lives).toBe(DEFAULT_CONFIG.lives);
  });

  it('ends the game when the last life is lost', () => {
    const w = makeWorld({ lives: 1 });
    let ended = false;
    w.events.on('gameOver', () => (ended = true));
    w.requestFloor(4);
    run(w, 2);
    w.spawnPassenger(0, 1);
    run(w, DEFAULT_CONFIG.passengers.patience + 0.1);
    expect(ended).toBe(true);
    expect(w.over).toBe(true);
  });
});

describe('walkouts and run states', () => {
  const patience = DEFAULT_CONFIG.passengers.patience;
  const { breather } = DEFAULT_CONFIG.walkout;

  /** Lift parked on 4 with a rider aboard, people waiting on 0 and 2, and some coins already earned. */
  function busyWorld(overrides: Partial<GameConfig> = {}): World {
    const w = makeWorld({ lift: { ...BASE.lift, capacity: 2 }, ...overrides });
    w.spawnPassenger(0, 3);
    run(w, 0.5);
    w.requestFloor(3);
    run(w, 3); // delivered: some coins in the bank
    w.spawnPassenger(3, 1);
    run(w, 0.5); // now riding toward 1
    w.requestFloor(4);
    run(w, 2);
    w.spawnPassenger(0, 2);
    w.spawnPassenger(2, 4);
    return w;
  }

  it('starts each run with 3 lives, playing', () => {
    const w = new World(cloneConfig());
    expect(w.lives).toBe(3);
    expect(w.state).toBe('playing');
  });

  it('one walkout empties the whole building and costs exactly one life, keeping earnings', () => {
    const w = busyWorld();
    const score = w.score;
    const events: { floor: number; leavers: number; riders: number }[] = [];
    w.events.on('walkout', (e) =>
      events.push({ floor: e.floor, leavers: e.leavers.length, riders: e.leavers.filter((l) => l.floor === null).length }),
    );
    run(w, patience);
    expect(events).toEqual([{ floor: 0, leavers: 3, riders: 1 }]);
    expect(w.lives).toBe(DEFAULT_CONFIG.lives - 1);
    expect(w.state).toBe('walkout');
    expect(w.passengers.size).toBe(0);
    expect(w.queues.every((q) => q.length === 0)).toBe(true);
    expect(w.lift.riders).toHaveLength(0);
    expect(w.lift.target).toBe(0);
    expect(w.score).toBe(score);
    expect(w.delivered).toBe(1);
  });

  it('several people running out on the same tick still cost only one life', () => {
    const w = makeWorld();
    w.requestFloor(4);
    run(w, 2);
    w.spawnPassenger(0, 2);
    w.spawnPassenger(1, 3);
    w.spawnPassenger(2, 0);
    let walkouts = 0;
    w.events.on('walkout', () => walkouts++);
    run(w, patience + 0.5);
    expect(walkouts).toBe(1);
    expect(w.lives).toBe(DEFAULT_CONFIG.lives - 1);
  });

  it('during the breather nobody spawns, nobody loses patience and input is ignored', () => {
    const w = busyWorld({ spawn: { ...BASE.spawn, firstDelay: 0, startInterval: 0.2, minInterval: 0.2 } });
    while (w.state === 'playing') w.update(1 / 60);
    expect(w.state).toBe('walkout');
    let spawns = 0;
    w.events.on('spawn', () => spawns++);
    w.requestFloor(3);
    w.hold(1);
    run(w, breather - 0.2);
    expect(spawns).toBe(0);
    expect(w.lift.target).toBe(0);
    expect(w.lives).toBe(DEFAULT_CONFIG.lives - 1);
    expect(w.state).toBe('walkout');
  });

  it('after about 4 seconds at the ground floor play resumes, easing spawns back in', () => {
    const w = busyWorld();
    run(w, patience);
    let recoveredAt = -1;
    let t = 0;
    w.events.on('recovered', () => (recoveredAt = t));
    for (; t < breather + 3; t += 1 / 60) w.update(1 / 60);
    expect(recoveredAt).toBeGreaterThanOrEqual(breather - 0.05);
    expect(recoveredAt).toBeLessThan(breather + 0.5);
    expect(w.state).toBe('playing');
    expect(w.lift.stoppedAt).toBe(0);

    const eased = w.spawnInterval();
    run(w, DEFAULT_CONFIG.walkout.easeIn);
    expect(eased).toBeGreaterThan(w.spawnInterval() * 1.5); // started roughly doubled
    w.requestFloor(2); // input works again
    expect(w.lift.target).toBe(2);
  });

  it('losing the last life ends the run once, with its stats, and freezes the world', () => {
    const w = busyWorld({ lives: 1 });
    const over: unknown[] = [];
    w.events.on('gameOver', (s) => over.push(s));
    run(w, patience);
    expect(w.state).toBe('over');
    expect(w.over).toBe(true);
    expect(over).toHaveLength(1);
    expect(over[0]).toMatchObject({ score: w.score, delivered: 1, bestDelivery: w.score });
    expect((over[0] as { time: number }).time).toBeGreaterThan(patience);
    const before = w.lift.position;
    w.requestFloor(3);
    run(w, 5);
    expect(w.lift.position).toBe(before);
    expect(over).toHaveLength(1);
  });

  it('a new run after game over starts completely fresh', () => {
    const cfg = cloneConfig();
    const old = new World(cfg);
    old.lives = 1;
    old.score = 500;
    cfg.lift.capacity += 3; // like a perk: mutates only this run's config copy
    old.spawnPassenger(1, 0);
    old.update(patience + 1);
    expect(old.over).toBe(true);

    const fresh = new World(cloneConfig());
    expect(fresh.state).toBe('playing');
    expect(fresh.lives).toBe(DEFAULT_CONFIG.lives);
    expect(fresh.score).toBe(0);
    expect(fresh.delivered).toBe(0);
    expect(fresh.elapsed).toBe(0);
    expect(fresh.bestDelivery).toBe(0);
    expect(fresh.passengers.size).toBe(0);
    expect(fresh.lift.capacity).toBe(DEFAULT_CONFIG.lift.capacity);
  });
});

describe('spawning', () => {
  it('speeds up over time and respects the per-floor queue limit', () => {
    const w = new World(BASE, Math.random);
    const early = w.spawnInterval();
    // Keep the lift parked on top so nobody gets picked up; give infinite lives.
    w.lives = 1e9;
    w.requestFloor(4);
    run(w, 200, 1 / 30);
    expect(w.spawnInterval()).toBeLessThan(early);
    for (const q of w.queues) expect(q.length).toBeLessThanOrEqual(DEFAULT_CONFIG.passengers.maxWaitingPerFloor);
  });

  it('newcomers get less patient as the shift ramps up, bottoming out at latePatience', () => {
    const w = makeWorld({ passengers: { ...BASE.passengers, latePatience: 0.6 } });
    const full = BASE.passengers.patience;
    expect(w.spawnPassenger(0, 2)!.maxPatience).toBe(full);
    w.time = BASE.spawn.rampTime / 2;
    expect(w.spawnPassenger(0, 2)!.maxPatience).toBeCloseTo(full * 0.8);
    w.time = BASE.spawn.rampTime * 3;
    const late = w.spawnPassenger(1, 3)!;
    expect(late.maxPatience).toBeCloseTo(full * 0.6);
    expect(late.patience).toBe(late.maxPatience);
  });
});

describe('menu demo to live shift', () => {
  it('startShift resets counters and refills patience but keeps the building as it is', () => {
    // Arrange: a demo world with infinite lives and no drafts, run for a while
    const w = makeWorld({ draft: { ...DEFAULT_CONFIG.draft, first: Infinity } });
    w.lives = Infinity;
    w.spawnPassenger(0, 2);
    run(w, 1);
    w.requestFloor(2);
    run(w, 3);
    const waiting = w.spawnPassenger(3, 0)!;
    run(w, 5);
    expect(w.delivered).toBe(1);
    expect(waiting.patience).toBeLessThan(waiting.maxPatience);

    // Act: restore the live config, then go live
    w.cfg.draft.first = DEFAULT_CONFIG.draft.first;
    w.startShift();

    // Assert
    expect(w.score).toBe(0);
    expect(w.delivered).toBe(0);
    expect(w.time).toBe(0);
    expect(w.lives).toBe(DEFAULT_CONFIG.lives);
    expect(w.maxLives).toBe(DEFAULT_CONFIG.lives);
    expect(waiting.patience).toBe(waiting.maxPatience);
    expect(w.queues[3]).toEqual([waiting.id]);
    expect(w.lift.position).toBe(2);
  });

  it('after startShift the first draft comes at the live threshold', () => {
    const w = makeWorld({ draft: { ...DEFAULT_CONFIG.draft, first: Infinity } });
    w.cfg.draft.first = 1;
    w.startShift();
    w.spawnPassenger(0, 1);
    run(w, 0.5);
    w.requestFloor(1);
    run(w, 3);
    expect(w.offer).not.toBeNull();
  });
});

describe('perk xp', () => {
  it('draft progress counts deliveries towards the next draft, then restarts from it after a pick', () => {
    // Arrange: first draft at 4 deliveries, then a gap of 6
    const w = makeWorld({ draft: { ...DEFAULT_CONFIG.draft, first: 4, gap: 6, gapGrowth: 0 } });
    w.delivered = 3;
    expect(w.draftProgress).toEqual({ done: 3, need: 4 });

    // Act: reach the threshold, take the offered perk, deliver two more
    w.delivered = 4;
    run(w, 0.1);
    w.choosePerk(w.offer![0].id);
    w.delivered = 6;

    // Assert: progress is measured from the last draft (4) to the next (10)
    expect(w.draftProgress).toEqual({ done: 2, need: 6 });
  });
});

describe('hold controls', () => {
  it('a quick tap of up from rest moves exactly one floor', () => {
    const w = makeWorld();
    w.hold(1);
    w.update(1 / 60);
    w.release();
    run(w, 2);
    expect(w.lift.stoppedAt).toBe(1);
  });

  it('holding passes floors without stopping, and release settles exactly on a floor', () => {
    const w = makeWorld();
    w.hold(1);
    run(w, 0.8);
    expect(w.lift.position).toBeGreaterThan(1); // went past floor 1 without stopping
    w.release();
    run(w, 3);
    expect(Number.isInteger(w.lift.stoppedAt)).toBe(true);
  });

  // A slow lift, so the coasting distance is tiny and "nearest floor" is unambiguous.
  const slow = { lift: { ...BASE.lift, maxSpeed: 1, accel: 10 } };
  const holdUpTo = (w: World, pos: number) => {
    w.hold(1);
    while (w.lift.position < pos) w.update(1 / 60);
  };

  it('releasing just past a floor eases back down to it', () => {
    const w = makeWorld(slow);
    holdUpTo(w, 1.2);
    w.release();
    run(w, 3);
    expect(w.lift.stoppedAt).toBe(1);
  });

  it('at full game speed, releasing a little past a floor still settles back on it', () => {
    const w = makeWorld({ lift: { ...DEFAULT_CONFIG.lift } }); // the real starting lift
    w.hold(1);
    while (w.lift.position < 1.2) w.update(1 / 60);
    expect(w.lift.velocity).toBeCloseTo(DEFAULT_CONFIG.lift.maxSpeed, 1);
    w.release();
    let max = 0;
    for (let i = 0; i < 240; i++) {
      w.update(1 / 60);
      max = Math.max(max, w.lift.position);
    }
    expect(w.lift.stoppedAt).toBe(1);
    expect(max).toBeLessThan(1.45); // a short settle, not a big bounce
  });

  it('releasing closer to the next floor carries on up to it', () => {
    const w = makeWorld(slow);
    holdUpTo(w, 1.65);
    w.release();
    run(w, 3);
    expect(w.lift.stoppedAt).toBe(2);
  });

  it('releasing while exactly on a floor stops there', () => {
    const w = makeWorld(slow);
    holdUpTo(w, 1);
    w.lift.position = 1; // land exactly on the floor at speed
    w.release();
    let max = 0;
    for (let i = 0; i < 180; i++) {
      w.update(1 / 60);
      max = Math.max(max, w.lift.position);
    }
    expect(w.lift.stoppedAt).toBe(1);
    expect(max).toBeLessThan(1.2);
  });

  it('holding stops at the end of the shaft', () => {
    const w = makeWorld();
    w.hold(1);
    run(w, 5);
    expect(w.lift.stoppedAt).toBe(BASE.floors - 1);
    w.hold(-1);
    w.release();
    run(w, 2);
    expect(w.lift.stoppedAt).toBe(BASE.floors - 2);
  });

  it('holding down on the ground floor does nothing', () => {
    const w = makeWorld();
    w.hold(-1);
    run(w, 1);
    w.release();
    run(w, 1);
    expect(w.lift.stoppedAt).toBe(0);
  });
});

describe('floors opening mid-shift', () => {
  const opening = { start: 2, every: 20 };

  it('starts with only the first floors open: no spawns, travel or requests above them', () => {
    const w = new World({ ...BASE, opening }, Math.random);
    w.lives = 1e9;
    expect(w.openFloors).toBe(2);
    w.requestFloor(3);
    expect(w.lift.target).toBe(0);
    w.hold(1);
    run(w, 5, 1 / 30);
    expect(w.lift.position).toBeLessThanOrEqual(1);
    w.release();
    for (const p of w.passengers.values()) {
      expect(p.origin).toBeLessThan(2);
      expect(p.dest).toBeLessThan(2);
    }
  });

  it('opens one more floor every `every` seconds, bottom to top, until the tower is full', () => {
    const w = makeWorld({ opening });
    const opened: number[] = [];
    w.events.on('floorOpen', ({ floor }) => opened.push(floor));
    run(w, 19.5);
    expect(opened).toEqual([]);
    expect(w.nextOpeningAt).toBe(20);
    run(w, 1);
    expect(opened).toEqual([2]);
    expect(w.openFloors).toBe(3);
    run(w, 60);
    expect(opened).toEqual([2, 3, 4]);
    expect(w.nextOpeningAt).toBe(Infinity);
    w.requestFloor(4);
    expect(w.lift.target).toBe(4);
  });

  it('the opening clock stands still during a walkout breather', () => {
    const w = makeWorld({ opening, lift: { ...BASE.lift, capacity: 2 } });
    w.spawnPassenger(1, 0);
    run(w, BASE.passengers.patience + 0.1); // nobody fetched them: walkout at ~20 s, floor 2 opened
    expect(w.state).toBe('walkout');
    const open = w.openFloors;
    const t = w.time;
    run(w, 2);
    expect(w.time).toBe(t);
    expect(w.openFloors).toBe(open);
  });
});
