import type { World } from './World';

// In-shift perks (the roguelike layer). Picked from drafts, stack up to `max`,
// and reset when the shift ends. Each one tweaks the shift's own config copy.

export type Rarity = 'common' | 'rare';

export interface Perk {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  max: number;
  /** only offered while this holds, e.g. group bonuses need a second seat */
  requires?: (w: World) => boolean;
  apply(w: World): void;
}

export const PERKS: Perk[] = [
  {
    id: 'roomy',
    name: 'Roomy Cab',
    desc: '+1 seat in the lift',
    rarity: 'common',
    max: 2,
    apply: (w) => void (w.cfg.lift.capacity += 1),
  },
  {
    id: 'turbo',
    name: 'Turbo Motor',
    desc: 'Lift moves 15% faster',
    rarity: 'common',
    max: 3,
    apply: (w) => {
      w.cfg.lift.maxSpeed *= 1.15;
      w.cfg.lift.accel *= 1.15;
    },
  },
  {
    id: 'music',
    name: 'Lift Music',
    desc: 'Soothing tunes: everyone waiting calms down, newcomers are 10% more patient',
    rarity: 'common',
    max: 3,
    apply: (w) => {
      w.cfg.passengers.patience *= 1.1;
      for (const q of w.queues)
        for (const id of q) {
          const p = w.passengers.get(id)!;
          p.patience = Math.min(p.maxPatience, p.patience + p.maxPatience * 0.3);
        }
    },
  },
  {
    id: 'tipjar',
    name: 'Tip Jar',
    desc: '+4 coins for every delivery',
    rarity: 'common',
    max: 5,
    apply: (w) => void (w.cfg.scoring.base += 4),
  },
  {
    id: 'doors',
    name: 'Snappy Doors',
    desc: 'People get on and off 25% quicker',
    rarity: 'common',
    max: 2,
    apply: (w) => void (w.cfg.lift.transferInterval *= 0.75),
  },
  {
    id: 'express',
    name: 'Express Service',
    desc: 'Quick-trip bonus is 50% bigger',
    rarity: 'common',
    max: 3,
    apply: (w) => void (w.cfg.scoring.patienceBonus = Math.round(w.cfg.scoring.patienceBonus * 1.5)),
  },
  {
    id: 'party',
    name: 'Party Lift',
    desc: 'Group drop-off bonus +5',
    rarity: 'rare',
    max: 3,
    requires: (w) => w.lift.capacity > 1,
    apply: (w) => void (w.cfg.scoring.groupBonus += 5),
  },
  {
    id: 'plaster',
    name: 'Plaster',
    desc: '+1 heart',
    rarity: 'rare',
    max: 3,
    apply: (w) => {
      w.lives += 1;
      w.maxLives = Math.max(w.maxLives, w.lives);
    },
  },
  {
    id: 'comfy',
    name: 'Comfy Seats',
    desc: 'Riders never lose patience',
    rarity: 'rare',
    max: 1,
    apply: (w) => void (w.cfg.passengers.ridingDrain = 0),
  },
];

/** Offered only when everything else is maxed out. */
export const COIN_BAG: Perk = {
  id: 'coinbag',
  name: 'Coin Bag',
  desc: '+50 coins right now',
  rarity: 'common',
  max: Infinity,
  apply: (w) => void (w.score += 50),
};

const WEIGHT: Record<Rarity, number> = { common: 3, rare: 1 };

export function perkById(id: string): Perk | undefined {
  return id === COIN_BAG.id ? COIN_BAG : PERKS.find((p) => p.id === id);
}

/** Weighted draw of `n` different perks that aren't maxed yet (and suit world `w`, if given). */
export function drawPerks(rng: () => number, n: number, taken: Record<string, number>, w?: World): Perk[] {
  const pool = PERKS.filter((p) => (taken[p.id] ?? 0) < p.max && (!w || !p.requires || p.requires(w)));
  const out: Perk[] = [];
  while (out.length < n && pool.length > 0) {
    const total = pool.reduce((s, p) => s + WEIGHT[p.rarity], 0);
    let roll = rng() * total;
    const i = pool.findIndex((p) => (roll -= WEIGHT[p.rarity]) < 0);
    out.push(pool.splice(i < 0 ? pool.length - 1 : i, 1)[0]);
  }
  if (out.length < n) out.push(COIN_BAG);
  return out;
}
