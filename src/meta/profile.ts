import { cloneConfig, type GameConfig } from '../config';
import { ACCESSORY_SETS, DEFAULT_SKIN, type ShopItem } from './catalog';

// The player's save: banked coins and everything bought. Pure logic plus a thin
// localStorage wrapper, so the shop rules are unit-testable.

export interface Profile {
  v: 1;
  coins: number;
  best: number;
  shifts: number;
  /** upgrade id -> level */
  upgrades: Record<string, number>;
  /** bought room, skin and style ids */
  owned: string[];
  cabSkin: string;
  /** personal bests besides coins (which is `best`) */
  records: RunRecords;
}

export interface RunRecords {
  delivered: number;
  /** biggest single drop-off payout */
  bestDelivery: number;
  /** longest shift, seconds */
  time: number;
}

const KEY = 'going-up-profile';
const OLD_BEST_KEY = 'going-up-best';

export function newProfile(): Profile {
  return {
    v: 1,
    coins: 0,
    best: 0,
    shifts: 0,
    upgrades: {},
    owned: [],
    cabSkin: DEFAULT_SKIN,
    records: { delivered: 0, bestDelivery: 0, time: 0 },
  };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Profile>;
      const base = newProfile();
      return { ...base, ...saved, records: { ...base.records, ...saved.records } };
    }
    const p = newProfile();
    p.best = Number(localStorage.getItem(OLD_BEST_KEY) ?? 0) || 0;
    return p;
  } catch {
    return newProfile();
  }
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: progress lasts for this session only */
  }
}

export function itemLevel(p: Profile, item: ShopItem): number {
  if (item.kind === 'upgrade') return p.upgrades[item.id] ?? 0;
  return p.owned.includes(item.id) ? 1 : 0;
}

/** Price of the next level, or null when maxed/owned. */
export function nextCost(p: Profile, item: ShopItem): number | null {
  return item.costs[itemLevel(p, item)] ?? null;
}

export function buy(p: Profile, item: ShopItem): boolean {
  const cost = nextCost(p, item);
  if (cost === null || cost > p.coins) return false;
  p.coins -= cost;
  if (item.kind === 'upgrade') p.upgrades[item.id] = itemLevel(p, item) + 1;
  else p.owned.push(item.id);
  if (item.kind === 'skin') p.cabSkin = item.id;
  return true;
}

/** Add a finished shift's takings. Returns true for a new best. */
export function bankShift(p: Profile, score: number): boolean {
  p.coins += score;
  p.shifts += 1;
  const isBest = score > p.best;
  if (isBest) p.best = score;
  return isBest;
}

/** Update personal bests from a finished run. Returns which ones it beat. */
export function recordRun(p: Profile, run: RunRecords): Record<keyof RunRecords, boolean> {
  const beat = {
    delivered: run.delivered > p.records.delivered,
    bestDelivery: run.bestDelivery > p.records.bestDelivery,
    time: run.time > p.records.time,
  };
  for (const k of Object.keys(beat) as (keyof RunRecords)[]) if (beat[k]) p.records[k] = run[k];
  return beat;
}

/** The shift's config: defaults plus permanent upgrades. */
export function runConfig(p: Profile): GameConfig {
  const cfg = cloneConfig();
  const lvl = (id: string) => p.upgrades[id] ?? 0;
  cfg.floors += lvl('floors');
  cfg.lift.maxSpeed *= 1 + 0.15 * lvl('motor');
  cfg.lift.accel *= 1 + 0.15 * lvl('motor');
  cfg.passengers.patience *= 1 + 0.1 * lvl('music');
  cfg.lift.capacity += lvl('capacity');
  cfg.lives += lvl('heart');
  if (lvl('headstart')) cfg.draft.first = 0;
  if (lvl('lucky')) cfg.draft.choices = 4;
  return cfg;
}

export function accessories(p: Profile): string[] {
  return Object.entries(ACCESSORY_SETS)
    .filter(([id]) => id === 'basics' || p.owned.includes(id))
    .flatMap(([, list]) => list);
}
