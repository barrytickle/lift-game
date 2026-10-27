// Balance probe: a greedy bot plays many headless games, taking a random card at each perk draft.
// `npm run balance` = fresh profile; `npm run balance -- maxed` = every shop upgrade bought.
import { UPGRADES } from '../src/meta/catalog';
import { newProfile, runConfig } from '../src/meta/profile';
import { World } from '../src/sim/World';

const profile = newProfile();
if (process.argv.includes('maxed')) for (const u of UPGRADES) profile.upgrades[u.id] = u.costs.length;

function play(reaction: number, skill: number) {
  const w = new World(runConfig(profile));
  let wait = 0;
  const dt = 1 / 60;
  while (!w.over && w.time < 900) {
    if (w.offer) w.choosePerk(w.offer[Math.floor(Math.random() * w.offer.length)].id);
    w.update(dt);
    const at = w.lift.stoppedAt;
    if (at === null) continue;
    const busy =
      w.lift.riders.some((id) => w.passengers.get(id)!.dest === at) || (w.queues[at].length > 0 && !w.lift.isFull);
    if (busy) { wait = 0; continue; }
    wait += dt;
    if (wait < reaction) continue;
    let best = -1, bestScore = -Infinity;
    for (let f = 0; f < w.cfg.floors; f++) {
      if (f === at) continue;
      const drop = w.lift.riders.filter((id) => w.passengers.get(id)!.dest === f).length;
      const room = w.lift.capacity - w.lift.riders.length + drop;
      const q = w.queues[f].map((id) => w.passengers.get(id)!);
      const urgency = q.slice(0, room).reduce((s, p) => s + 1 + 3 * (1 - p.patience / p.maxPatience), 0);
      const s = (drop * 2 + urgency) / (1 + Math.abs(f - at) * 0.5) + (Math.random() - 0.5) * (1 - skill) * 6;
      if (s > bestScore) { bestScore = s; best = f; }
    }
    if (bestScore > 0) w.requestFloor(best);
    wait = 0;
  }
  return { time: Math.round(w.time), score: w.score, delivered: w.delivered };
}

for (const [label, reaction, skill] of [['sharp', 0.25, 1], ['average', 0.6, 0.6], ['sloppy', 1.0, 0.2]] as const) {
  const runs = Array.from({ length: 30 }, () => play(reaction, skill));
  const avg = (k: 'time' | 'score' | 'delivered') => Math.round(runs.reduce((s, r) => s + r[k], 0) / runs.length);
  console.log(label.padEnd(8), 'avg time', avg('time'), 's  score', avg('score'), ' delivered', avg('delivered'));
}
