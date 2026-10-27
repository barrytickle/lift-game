import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type GameConfig } from '../src/config';
import { World } from '../src/sim/World';

// A fixed 5-floor test tower with a brisk lift, so these tests cover the rules
// rather than the current tuning (which starts smaller and slower).
const BASE: GameConfig = {
  ...DEFAULT_CONFIG,
  floors: 5,
  lift: { ...DEFAULT_CONFIG.lift, maxSpeed: 3.4, accel: 10 },
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
