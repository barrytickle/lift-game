import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, type GameConfig } from '../src/config';
import { World } from '../src/sim/World';

// No random spawning in these tests: spawns are placed by hand.
function makeWorld(overrides: Partial<GameConfig> = {}): World {
  const cfg: GameConfig = {
    ...DEFAULT_CONFIG,
    spawn: { ...DEFAULT_CONFIG.spawn, firstDelay: 1e9 },
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
    const w = makeWorld();
    for (let i = 0; i < 6; i++) w.spawnPassenger(0, 2);
    run(w, 2);
    expect(w.lift.riders).toHaveLength(DEFAULT_CONFIG.lift.capacity);
    expect(w.queues[0]).toHaveLength(2);
  });

  it('lets riders off before new passengers board', () => {
    const w = makeWorld();
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
    const w = makeWorld();
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
    const w = new World(DEFAULT_CONFIG, Math.random);
    const early = w.spawnInterval();
    // Keep the lift parked on top so nobody gets picked up; give infinite lives.
    w.lives = 1e9;
    w.requestFloor(4);
    run(w, 200, 1 / 30);
    expect(w.spawnInterval()).toBeLessThan(early);
    for (const q of w.queues) expect(q.length).toBeLessThanOrEqual(DEFAULT_CONFIG.passengers.maxWaitingPerFloor);
  });
});
