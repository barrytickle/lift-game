// Balance probe: the autopilot plays many headless shifts, taking a random card at each perk draft.
// `npm run balance` = fresh profile; `npm run balance -- maxed` = every shop upgrade bought.
import { UPGRADES } from '../src/meta/catalog';
import { newProfile, runConfig } from '../src/meta/profile';
import { Autopilot } from '../src/sim/autopilot';
import { World } from '../src/sim/World';

const profile = newProfile();
if (process.argv.includes('maxed')) for (const u of UPGRADES) profile.upgrades[u.id] = u.costs.length;

function play(reaction: number, skill: number) {
  const w = new World(runConfig(profile));
  const pilot = new Autopilot(reaction, skill);
  const dt = 1 / 60;
  while (!w.over && w.time < 900) {
    if (w.offer) w.choosePerk(w.offer[Math.floor(Math.random() * w.offer.length)].id);
    w.update(dt);
    pilot.update(w, dt);
  }
  return { time: Math.round(w.elapsed), score: w.score, delivered: w.delivered };
}

for (const [label, reaction, skill] of [['sharp', 0.25, 1], ['average', 0.6, 0.6], ['sloppy', 1.0, 0.2]] as const) {
  const runs = Array.from({ length: 30 }, () => play(reaction, skill));
  const avg = (k: 'time' | 'score' | 'delivered') => Math.round(runs.reduce((s, r) => s + r[k], 0) / runs.length);
  console.log(label.padEnd(8), 'avg time', avg('time'), 's  score', avg('score'), ' delivered', avg('delivered'));
}
