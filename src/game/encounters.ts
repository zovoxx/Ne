import type { Game } from './game';
import type { RoomPlan, RunState } from './run';
import type { EnemyDef, Role } from './enemies/types';
import { ENEMY_LIST } from './enemies';
import { rollElite } from './enemies/elites';

export interface SpawnGroup {
  def: string;
  count: number;
  elite?: number;
  place?: 'near' | 'far' | 'flank' | 'ring' | 'behind' | 'center';
}
export interface Wave {
  groups: SpawnGroup[];
  name: string;
}

/**
 * Encounter templates: each wave is built from ROLES (front line, back line, support…),
 * then every role is filled with an enemy of that role from the biome pool. The same
 * template therefore produces many different fights, and different templates force
 * different answers (flank the shields, dive the healer, kite the swarm…).
 */
interface Template {
  name: string;
  slots: [Role, number, number][]; // role, min units, max units
  minStep?: number;
  weight?: number;
}

const TEMPLATES: Template[] = [
  { name: 'Rush', slots: [['front', 2, 3], ['swarm', 0, 1]], weight: 1.2 },
  { name: 'Wall & Guns', slots: [['tank', 1, 2], ['back', 1, 2]] },
  { name: 'Siege', slots: [['zone', 1, 2], ['front', 1, 3]] },
  { name: 'Protected Core', slots: [['support', 1, 1], ['tank', 1, 1], ['front', 1, 2]], minStep: 1 },
  { name: 'Hunters', slots: [['disrupt', 2, 2], ['front', 1, 1]] },
  { name: 'Swarm', slots: [['swarm', 2, 3], ['zone', 0, 1]] },
  { name: 'Crossfire', slots: [['back', 2, 2], ['disrupt', 1, 1]], minStep: 1 },
  { name: 'Artillery Line', slots: [['zone', 1, 1], ['back', 1, 1], ['tank', 1, 1]], minStep: 2 },
  { name: 'Warband', slots: [['support', 1, 1], ['front', 2, 3]], minStep: 1 },
  { name: 'Ambush', slots: [['disrupt', 1, 1], ['swarm', 1, 2], ['front', 1, 1]] },
  { name: 'Fortress', slots: [['tank', 2, 2], ['support', 0, 1], ['zone', 0, 1]], minStep: 2 },
  { name: 'Chaos', slots: [['front', 1, 1], ['back', 1, 1], ['zone', 1, 1], ['disrupt', 1, 1]], minStep: 3 },
];

const PLACE: Record<Role, SpawnGroup['place']> = {
  front: 'near',
  tank: 'near',
  swarm: 'ring',
  back: 'far',
  zone: 'far',
  support: 'far',
  disrupt: 'flank',
  elite: 'near',
};

/** set by the boss module so boss rooms don't add regular waves */
export const BOSS_HOOK = { hasBoss: (biome: number) => biome < 0 };

/** context provided by the app (meta progression): unlock tier and seen pairings */
export const ENCOUNTER_CTX = {
  tier: 0,
  seenPairs: new Set<string>(),
  /** later-biome enemies may invade earlier biomes (unlocked by deepening) */
  invaders: false,
  /** called whenever a wave introduces enemy pairings */
  onPairs: null as null | ((pairs: string[]) => void),
  /** debug: force a template */
  force: '' as string,
};

function poolFor(biome: number): EnemyDef[] {
  const tier = ENCOUNTER_CTX.tier;
  return ENEMY_LIST.filter((d) => (d.unlock ?? 0) <= tier && (d.biome === biome + 1 || (d.biome < biome + 1 && d.biome >= biome) || (ENCOUNTER_CTX.invaders && Math.abs(d.biome - (biome + 1)) === 1)));
}

/** enemies from this biome, plus a few from the previous biome so combinations keep evolving */
function candidates(biome: number, role: Role): { def: EnemyDef; w: number }[] {
  const tier = ENCOUNTER_CTX.tier;
  const out: { def: EnemyDef; w: number }[] = [];
  for (const d of ENEMY_LIST) {
    if ((d.unlock ?? 0) > tier) continue;
    if (!d.roles.includes(role)) continue;
    let w = 0;
    if (d.biome === biome + 1) w = 1;
    else if (d.biome === biome) w = 0.28; // previous biome
    else if (ENCOUNTER_CTX.invaders && d.biome === biome + 2) w = 0.12; // invader from below
    if (w <= 0) continue;
    if (d.roles[0] === role) w *= 1.3;
    out.push({ def: d, w });
  }
  return out;
}

const pairKey = (a: string, b: string) => (a < b ? a + '+' + b : b + '+' + a);

export function planEncounter(g: Game, run: RunState, plan: RoomPlan): Wave[] {
  const rng = g.rng;
  const biome = plan.biome;
  const step = plan.step;
  const waves: Wave[] = [];
  let nWaves = 3;
  let budget = 6.6 + step * 0.9 + biome * 1.6;
  let eliteCount = 0;
  if (plan.type === 'elite') {
    budget *= 1.1;
    eliteCount = 2 + (biome >= 2 ? 1 : 0);
  }
  if (plan.type === 'mini') {
    nWaves = 2;
    budget *= 0.6;
  }
  if (plan.type === 'boss') {
    // phase-5 bosses replace this stand-in when a boss spawner is installed
    nWaves = BOSS_HOOK.hasBoss(biome) ? 0 : 3;
    eliteCount = nWaves ? 3 : 0;
  }
  if (biome === 0 && step === 0) {
    budget = 4.5;
    nWaves = 3;
  }
  const usedTemplates = new Set<string>();
  for (let w = 0; w < nWaves; w++) {
    const waveBudget = budget * (w === 0 ? 0.8 : 1 + w * 0.12);
    const pool = TEMPLATES.filter((t) => (t.minStep ?? 0) <= step + biome * 2 && !usedTemplates.has(t.name));
    const tpl = (ENCOUNTER_CTX.force && TEMPLATES.find((t) => t.name === ENCOUNTER_CTX.force)) || rng.weighted(pool, (t) => t.weight ?? 1)!;
    usedTemplates.add(tpl.name);
    const groups: SpawnGroup[] = [];
    const chosen: string[] = [];
    let spent = 0;
    const counts: Record<string, number> = {};
    for (const [role, mn, mx] of tpl.slots) {
      const cands = candidates(biome, role);
      if (!cands.length) continue;
      const units = rng.int(mn, mx);
      for (let u = 0; u < units; u++) {
        // novelty: unseen pairings with already-chosen enemies get a big weight boost
        const pick = rng.weighted(cands, (c) => {
          let wt = c.w;
          if (c.def.max && (counts[c.def.id] ?? 0) >= c.def.max) return 0;
          for (const o of chosen) if (o !== c.def.id && !ENCOUNTER_CTX.seenPairs.has(pairKey(o, c.def.id))) wt *= 1.8;
          if (chosen.includes(c.def.id)) wt *= 0.55;
          return wt;
        });
        if (!pick) continue;
        const d = pick.def;
        const size = d.group ?? 1;
        if (spent + d.cost * size > waveBudget * 1.25 && groups.length > 0) continue;
        spent += d.cost * size;
        counts[d.id] = (counts[d.id] ?? 0) + size;
        chosen.push(d.id);
        groups.push({ def: d.id, count: size, place: PLACE[role] });
      }
    }
    // fill the remaining budget with front-liners so waves are never thin
    let guard = 0;
    while (spent < waveBudget && guard++ < 8) {
      const fill = rng.weighted(candidates(biome, rng.chance(0.5) ? 'front' : 'swarm'), (c) => (c.def.max && (counts[c.def.id] ?? 0) >= c.def.max ? 0 : c.w));
      if (!fill) break;
      const d = fill.def;
      const size = d.group ?? 1;
      spent += d.cost * size;
      counts[d.id] = (counts[d.id] ?? 0) + size;
      groups.push({ def: d.id, count: size, place: 'near' });
      chosen.push(d.id);
    }
    // elites: promote some single units
    if (eliteCount > 0) {
      const singles = groups.filter((gr) => gr.count === 1);
      const k = w === 0 ? 1 : Math.ceil(eliteCount / Math.max(1, nWaves - 1));
      for (let i = 0; i < k && singles.length; i++) {
        const gr = singles.splice(rng.int(0, singles.length - 1), 1)[0];
        gr.elite = rollElite(g, ENCOUNTER_CTX.tier >= 2 && rng.chance(0.4) ? 2 : 1);
      }
    } else if (biome >= 1 && rng.chance(0.12 + biome * 0.06)) {
      // the occasional lone elite keeps normal rooms spicy
      const singles = groups.filter((gr) => gr.count === 1);
      if (singles.length) singles[0].elite = rollElite(g, 1);
    }
    // record pairings for novelty
    const pairs: string[] = [];
    const uniq = [...new Set(chosen)];
    for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) pairs.push(pairKey(uniq[i], uniq[j]));
    for (const p of pairs) ENCOUNTER_CTX.seenPairs.add(p);
    ENCOUNTER_CTX.onPairs?.(pairs);
    waves.push({ name: tpl.name, groups });
  }
  void run;
  return waves;
}

export const _pool = poolFor;
