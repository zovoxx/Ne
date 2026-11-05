import type { Arena, Pillar } from './game';
import type { RNG } from './math';
import type { RewardKind, RoomPlan, RoomType, RunState } from './run';
import type { PatronId } from './boons/types';
import { PATRON_ORDER } from './boons/patrons';

/**
 * Biome structure. Each biome is a short corridor of rooms; "choice" steps show 2–3 doors.
 *   0 combat · 1 choice · 2 choice · 3 mini-boss · 4 choice (rest likely) · 5 boss
 */
export const BIOME_STEPS: ('combat' | 'choice' | 'mini' | 'boss')[] = ['combat', 'choice', 'choice', 'mini', 'choice', 'boss'];
export const BIOME_COUNT = 4;
export const BIOME_NAMES = ['The Ashen Gardens', 'The Drowned Archive', 'The Clockwork Foundry', 'The Starless Crown'];

export interface Door {
  x: number;
  y: number;
  r: number;
  plan: RoomPlan;
  t: number;
}

/** which patrons can appear (meta-progression unlocks) */
export const PATRON_POOL: { ids: PatronId[] } = { ids: ['ember', 'rime', 'storm', 'tide'] };

function pickPatron(rng: RNG, avoid: PatronId[]): PatronId {
  const pool = PATRON_POOL.ids.filter((p) => !avoid.includes(p));
  return rng.pick(pool.length ? pool : PATRON_POOL.ids);
}

function pickReward(rng: RNG, run: RunState, avoid: PatronId[], allowNonBoon = true): { reward: RewardKind; patron?: PatronId } {
  const opts: [RewardKind, number][] = [
    ['boon', 58],
    ['forge', allowNonBoon ? 12 : 0],
    ['kindle', allowNonBoon && run.boons.length >= 2 ? 12 : 0],
    ['heart', allowNonBoon ? 9 : 0],
    ['gold', allowNonBoon ? 9 : 0],
  ];
  const r = rng.weighted(opts, (o) => o[1])![0];
  if (r === 'boon') return { reward: r, patron: pickPatron(rng, avoid) };
  return { reward: r };
}

/** generates the doors offered after clearing the room at (biome, step) */
export function nextDoors(rng: RNG, run: RunState): RoomPlan[] {
  let biome = run.biome;
  let step = run.step + 1;
  if (step >= BIOME_STEPS.length) {
    biome++;
    step = 0;
  }
  if (biome >= BIOME_COUNT) return [];
  const kind = BIOME_STEPS[step];
  const plans: RoomPlan[] = [];
  const seed = () => (rng.next() * 1e9) | 0;
  const usedPatrons: PatronId[] = [];
  const mk = (type: RoomType, forceBoon = false): RoomPlan => {
    const r = forceBoon ? { reward: 'boon' as RewardKind, patron: pickPatron(rng, usedPatrons) } : pickReward(rng, run, usedPatrons);
    if (r.patron) usedPatrons.push(r.patron);
    return { type, biome, step, reward: r.reward, patron: r.patron, seed: seed(), rarity: type === 'elite' ? 1 : type === 'mini' ? 1 : 0 };
  };
  if (kind === 'combat') {
    plans.push(mk('combat', true), mk('combat', true));
  } else if (kind === 'mini') {
    plans.push(mk('mini', true), mk('mini', true));
  } else if (kind === 'boss') {
    plans.push({ type: 'boss', biome, step, reward: 'none', seed: seed() });
  } else {
    const n = rng.chance(0.55) ? 3 : 2;
    const hpLow = run.hp < run.maxHpBase * 0.55;
    const types: [RoomType, number][] = [
      ['combat', 55],
      ['elite', biome === 0 && step === 1 ? 0 : 20],
      ['shop', run.shopsThisBiome > 0 ? 0 : step === 4 ? 30 : 12],
      ['spring', step === 4 ? (hpLow ? 34 : 18) : hpLow ? 16 : 6],
      ['ordeal', biome === 0 ? 0 : 10],
    ];
    const used = new Set<RoomType>();
    for (let i = 0; i < n; i++) {
      const t = rng.weighted(types, (o) => (used.has(o[0]) && o[0] !== 'combat' ? 0 : o[1]))![0];
      used.add(t);
      if (t === 'shop' || t === 'spring') plans.push({ type: t, biome, step, reward: 'none', seed: seed() });
      else if (t === 'ordeal') plans.push({ type: t, biome, step, reward: 'boon', patron: pickPatron(rng, usedPatrons), seed: seed(), ordeal: rng.pick(['altar', 'gauntlet', 'wager']), rarity: 1 });
      else plans.push(mk(t));
    }
    // the pre-boss choice always offers a way to recover
    if (step === 4 && !plans.some((p) => p.type === 'shop' || p.type === 'spring')) plans[plans.length - 1] = { type: run.shopsThisBiome > 0 ? 'spring' : 'shop', biome, step, reward: 'none', seed: seed() };
  }
  return plans;
}

export function firstRoom(rng: RNG): RoomPlan {
  return { type: 'combat', biome: 0, step: 0, reward: 'boon', patron: pickPatron(rng, []), seed: (rng.next() * 1e9) | 0 };
}

/* ─────────────── arenas ─────────────── */

const LAYOUTS: ((w: number, h: number) => Pillar[])[] = [
  () => [],
  (w, h) => [
    { x: -w * 0.25, y: -h * 0.15, r: 40 },
    { x: w * 0.25, y: h * 0.15, r: 40 },
  ],
  (w, h) => [
    { x: -w * 0.28, y: -h * 0.22, r: 34 },
    { x: w * 0.28, y: -h * 0.22, r: 34 },
    { x: -w * 0.28, y: h * 0.22, r: 34 },
    { x: w * 0.28, y: h * 0.22, r: 34 },
  ],
  () => [{ x: 0, y: -20, r: 62 }],
  (w, h) => [
    { x: -w * 0.32, y: 0, r: 30 },
    { x: w * 0.32, y: 0, r: 30 },
    { x: 0, y: -h * 0.28, r: 30 },
  ],
  (w, h) => [
    { x: -w * 0.18, y: -h * 0.25, r: 28 },
    { x: w * 0.18, y: -h * 0.25, r: 28 },
    { x: -w * 0.36, y: h * 0.12, r: 28 },
    { x: w * 0.36, y: h * 0.12, r: 28 },
  ],
];

export function makeArena(rng: RNG, plan: RoomPlan): Arena {
  let w = 1240;
  let h = 760;
  let layout = rng.int(0, LAYOUTS.length - 1);
  switch (plan.type) {
    case 'combat':
      w = rng.pick([1100, 1200, 1300]);
      h = rng.pick([680, 740, 800]);
      break;
    case 'elite':
      w = 1300;
      h = 800;
      break;
    case 'mini':
      w = 1300;
      h = 820;
      layout = rng.pick([0, 2, 5]);
      break;
    case 'boss':
      w = 1480;
      h = 900;
      layout = plan.biome === 2 ? 2 : 0;
      break;
    case 'shop':
    case 'spring':
    case 'ordeal':
      w = 960;
      h = 600;
      layout = 0;
      break;
  }
  const pillars = LAYOUTS[layout](w, h);
  return { x0: -w / 2, y0: -h / 2, x1: w / 2, y1: h / 2, pillars, pits: [], style: plan.biome };
}

export function allPatronsIn(order = PATRON_ORDER) {
  return order;
}
