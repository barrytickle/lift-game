// All gameplay tuning lives here. Upgrades later = producing a modified copy of
// this object (e.g. capacity: 6, maxSpeed: 4.5) and handing it to a new World.

export interface GameConfig {
  floors: number;

  lift: {
    capacity: number;
    /** floors per second */
    maxSpeed: number;
    /** floors per second^2 when speeding up */
    accel: number;
    /** braking is this many times firmer than accel, so a released lift settles on the nearest floor */
    brake: number;
    /** seconds between one passenger stepping out/in and the next */
    transferInterval: number;
    /** releasing ▲/▼ before moving this far (floors) counts as a tap: go exactly one floor */
    tapDistance: number;
  };

  passengers: {
    /** seconds a passenger will wait in the lobby before storming off */
    patience: number;
    /** patience drains at this fraction of normal speed while riding */
    ridingDrain: number;
    /** queue length per floor; no spawns on a full floor */
    maxWaitingPerFloor: number;
  };

  spawn: {
    firstDelay: number;
    startInterval: number;
    minInterval: number;
    /** seconds of play to go from startInterval to minInterval */
    rampTime: number;
    /** after rampTime the interval keeps halving every this many seconds ("overtime")... */
    overtimeHalfLife: number;
    /** ...down to this hard floor */
    floorInterval: number;
    /** +/- fraction of randomness applied to each interval */
    jitter: number;
  };

  scoring: {
    base: number;
    /** extra coins scaled by remaining patience (0..1) */
    patienceBonus: number;
    /** extra coins per additional passenger dropped off at the same stop */
    groupBonus: number;
    /** extra coins per floor between pickup and drop-off, so taller towers pay more */
    perFloor: number;
  };

  /** perk drafts: first at `first` deliveries, then gaps of gap, gap+growth, gap+2*growth... */
  draft: {
    first: number;
    gap: number;
    gapGrowth: number;
    choices: number;
  };

  lives: number;

  /** building-wide walkout when someone runs out of patience */
  walkout: {
    /** seconds of breathing room: no spawns, no patience loss, lift heads home */
    breather: number;
    /** after the breather, spawns ease back from double the interval to normal over this many seconds */
    easeIn: number;
    /** seconds until the first newcomer after a walkout */
    firstSpawn: number;
  };
}

export const DEFAULT_CONFIG: GameConfig = {
  floors: 3, // the bare minimum; Taller Tower (shop) adds floors
  lift: {
    capacity: 1, // one seat to start; Bigger Cab (shop) and Roomy Cab (perk) add more
    maxSpeed: 2.2, // Better Motor (shop) and Turbo Motor (perk) speed it up
    accel: 6.5,
    brake: 2.5,
    transferInterval: 0.16,
    tapDistance: 0.25,
  },
  passengers: {
    patience: 20,
    ridingDrain: 0.35,
    maxWaitingPerFloor: 6,
  },
  spawn: {
    firstDelay: 0.6,
    startInterval: 4.0,
    minInterval: 1.4,
    rampTime: 180,
    overtimeHalfLife: 110,
    floorInterval: 0.3,
    jitter: 0.35,
  },
  scoring: {
    base: 10,
    patienceBonus: 15,
    groupBonus: 5,
    perFloor: 6,
  },
  draft: {
    first: 10,
    gap: 15,
    gapGrowth: 10,
    choices: 3,
  },
  lives: 3,
  walkout: {
    breather: 4,
    easeIn: 15,
    firstSpawn: 1.2,
  },
};

/** Each shift gets its own copy: perks and upgrades mutate it freely. */
export function cloneConfig(cfg: GameConfig = DEFAULT_CONFIG): GameConfig {
  return structuredClone(cfg);
}
