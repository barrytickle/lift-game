import { describe, expect, it } from 'vitest';
import { cloneConfig, DEFAULT_CONFIG } from '../src/config';
import { ALL_ITEMS, UPGRADES } from '../src/meta/catalog';
import { accessories, bankShift, buy, newProfile, nextCost, runConfig } from '../src/meta/profile';
import { COIN_BAG, drawPerks, PERKS } from '../src/sim/perks';
import { World } from '../src/sim/World';

function run(w: World, seconds: number, dt = 1 / 60): void {
  for (let t = 0; t < seconds; t += dt) w.update(dt);
}

function quietWorld(): World {
  const cfg = cloneConfig();
  cfg.spawn.firstDelay = 1e9;
  return new World(cfg, () => 0.5);
}

/** Deliver n passengers from G to 1, skipping any drafts by taking the first card. */
function deliver(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.requestFloor(0);
    run(w, 1);
    w.spawnPassenger(0, 1);
    run(w, 0.5);
    w.requestFloor(1);
    run(w, 1);
  }
}

describe('perk drafts', () => {
  it('pauses the shift at the first milestone until a perk is chosen', () => {
    const w = quietWorld();
    const offers: string[][] = [];
    w.events.on('draft', ({ offer }) => offers.push(offer.map((p) => p.id)));
    deliver(w, DEFAULT_CONFIG.draft.first);
    run(w, 0.1);
    expect(offers).toHaveLength(1);
    expect(offers[0]).toHaveLength(DEFAULT_CONFIG.draft.choices);

    const t = w.time;
    run(w, 5);
    expect(w.time).toBe(t); // frozen

    w.choosePerk(offers[0][0]);
    expect(w.offer).toBeNull();
    run(w, 1);
    expect(w.time).toBeGreaterThan(t);
  });

  it('applies perks to this shift only', () => {
    const w = quietWorld();
    w.offer = [PERKS.find((p) => p.id === 'roomy')!];
    w.choosePerk('roomy');
    expect(w.lift.capacity).toBe(DEFAULT_CONFIG.lift.capacity + 1);
    expect(DEFAULT_CONFIG.lift.capacity).toBe(1);
  });

  it('ignores a pick that was not on offer', () => {
    const w = quietWorld();
    w.offer = [PERKS[0]];
    w.choosePerk('plaster');
    expect(w.offer).not.toBeNull();
    expect(w.lives).toBe(DEFAULT_CONFIG.lives);
  });

  it('never offers duplicates or maxed perks, and falls back to a coin bag', () => {
    const offer = drawPerks(Math.random, 3, {});
    expect(new Set(offer.map((p) => p.id)).size).toBe(3);

    const allMaxed = Object.fromEntries(PERKS.map((p) => [p.id, p.max]));
    expect(drawPerks(Math.random, 3, allMaxed)).toEqual([COIN_BAG]);
  });

  it('only offers Party Lift once the cab has a second seat', () => {
    const w = quietWorld();
    let rolls = 0;
    const rng = () => (rolls++ * 0.137) % 1;
    const offered = (world: World) =>
      Array.from({ length: 50 }, () => drawPerks(rng, 3, {}, world)).some((o) => o.some((p) => p.id === 'party'));
    expect(offered(w)).toBe(false);
    w.cfg.lift.capacity = 2;
    expect(offered(w)).toBe(true);
  });
});

describe('shop and profile', () => {
  it('buys upgrade levels in order and refuses when broke or maxed', () => {
    const p = newProfile();
    const motor = UPGRADES.find((u) => u.id === 'motor')!;
    expect(buy(p, motor)).toBe(false);
    p.coins = 10_000;
    for (const cost of motor.costs) {
      expect(nextCost(p, motor)).toBe(cost);
      expect(buy(p, motor)).toBe(true);
    }
    expect(nextCost(p, motor)).toBeNull();
    expect(buy(p, motor)).toBe(false);
    expect(p.coins).toBe(10_000 - motor.costs.reduce((a, b) => a + b, 0));
  });

  it('buying a cab skin equips it', () => {
    const p = newProfile();
    p.coins = 1000;
    buy(p, ALL_ITEMS.find((i) => i.id === 'skin-mint')!);
    expect(p.cabSkin).toBe('skin-mint');
  });

  it('turns upgrades into the shift config without touching the defaults', () => {
    const p = newProfile();
    p.upgrades = { capacity: 2, heart: 1, motor: 3, headstart: 1, lucky: 1 };
    const cfg = runConfig(p);
    expect(cfg.lift.capacity).toBe(3);
    expect(cfg.lives).toBe(6);
    expect(cfg.lift.maxSpeed).toBeCloseTo(DEFAULT_CONFIG.lift.maxSpeed * 1.3);
    expect(cfg.draft.first).toBe(0);
    expect(cfg.draft.choices).toBe(4);
    expect(DEFAULT_CONFIG.lift.capacity).toBe(1);
  });

  it('banks shift coins and tracks the best', () => {
    const p = newProfile();
    expect(bankShift(p, 500)).toBe(true);
    expect(bankShift(p, 300)).toBe(false);
    expect(p.coins).toBe(800);
    expect(p.best).toBe(500);
  });

  it('style packs add accessories', () => {
    const p = newProfile();
    expect(accessories(p)).not.toContain('crown');
    p.owned.push('style-fancy');
    expect(accessories(p)).toContain('crown');
  });
});
