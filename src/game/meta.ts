import type { MetaSave } from './save';
import type { PatronId } from './boons/types';
import type { WeaponId } from './weapons/types';
import { PATRON_POOL } from './rooms';
import { ENCOUNTER_CTX } from './encounters';
import { ELITE, ELITE_POOL } from './enemies/elites';
import { BOON_RULES } from './run';

/**
 * THE WICK — permanent progression. Mostly unlocks VARIETY (weapons, Lights, duo boons,
 * new enemies and elite modifiers, keepsakes); only a few small stat upgrades.
 */
export interface Unlock {
  id: string;
  group: 'Weapons' | 'Lights' | 'Keepsakes' | 'The Wick' | 'Deepening';
  name: string;
  desc: string;
  cost: number;
  requires?: string[];
}

export const UNLOCKS: Unlock[] = [
  { id: 'w_pike', group: 'Weapons', name: 'Moonreach', desc: 'A crescent pike: tip crits and a whirling special.', cost: 15 },
  { id: 'w_anvil', group: 'Weapons', name: 'Anvilheart', desc: 'A molten maul: armor-breaking swings and a charged fissure.', cost: 35 },
  { id: 'w_bow', group: 'Weapons', name: 'Vesper Bow', desc: 'Quick shots, perfect-release power shots and starfall.', cost: 55 },
  { id: 'w_halo', group: 'Weapons', name: 'Sunwheel Halo', desc: 'A returning chakram that cuts both ways.', cost: 80 },
  { id: 'p_dawn', group: 'Lights', name: 'Solenne, the Dawnmother', desc: 'Marks and critical hits join the run.', cost: 25 },
  { id: 'p_gale', group: 'Lights', name: 'Siffra, the Running Wind', desc: 'Speed, dash charges and wind blades.', cost: 25 },
  { id: 'p_umbra', group: 'Lights', name: 'Oruun, the Hollow Eye', desc: 'Spreading hexes and death bursts.', cost: 45 },
  { id: 'p_thorn', group: 'Lights', name: 'Brakka, the Thornmother', desc: 'Bleed stacks that burst on heavy hits.', cost: 45 },
  { id: 'concord', group: 'The Wick', name: 'Concord', desc: 'Duo boons can appear when two Lights favour you.', cost: 40 },
  { id: 'heart1', group: 'The Wick', name: 'Ember Heart', desc: '+10 max health.', cost: 15 },
  { id: 'heart2', group: 'The Wick', name: 'Ember Heart II', desc: '+10 more max health.', cost: 35, requires: ['heart1'] },
  { id: 'defy2', group: 'The Wick', name: 'Second Wick', desc: '+1 Death Defiance each run.', cost: 60 },
  { id: 'reroll2', group: 'The Wick', name: 'Fate Die', desc: '+1 reroll each run.', cost: 25 },
  { id: 'purse', group: 'The Wick', name: 'Moth Purse', desc: 'Start each run with 40 gold.', cost: 20 },
  { id: 'k_charm', group: 'Keepsakes', name: 'Lucky Moth', desc: 'Keepsake: +5% critical chance.', cost: 15 },
  { id: 'k_feather', group: 'Keepsakes', name: 'Swift Feather', desc: 'Keepsake: move 8% faster.', cost: 15 },
  { id: 'k_locket', group: 'Keepsakes', name: 'Iron Locket', desc: 'Keepsake: +15 max health.', cost: 20 },
  { id: 'k_whetstone', group: 'Keepsakes', name: 'Whetstone', desc: 'Keepsake: attacks deal +10% damage.', cost: 25 },
  { id: 'deep1', group: 'Deepening', name: 'Deepening I', desc: 'New enemies (burrowers, dodgers, mines, saws, mites, lancers, null shards) and new elite types. +20% embers.', cost: 30 },
  { id: 'deep2', group: 'Deepening', name: 'Deepening II', desc: 'Enemies from neighbouring depths invade, and elites can carry two modifiers. +20% more embers.', cost: 70, requires: ['deep1'] },
];

export const KEEPSAKE_IDS: Record<string, string> = { k_charm: 'charm', k_feather: 'feather', k_locket: 'locket', k_whetstone: 'whetstone' };

export function has(m: MetaSave, id: string) {
  return m.unlocks.includes(id);
}

export function canBuy(m: MetaSave, u: Unlock) {
  return !has(m, u.id) && m.embers >= u.cost && (u.requires ?? []).every((r) => has(m, r));
}

export function buy(m: MetaSave, id: string): boolean {
  const u = UNLOCKS.find((x) => x.id === id);
  if (!u || !canBuy(m, u)) return false;
  m.embers -= u.cost;
  m.unlocks.push(u.id);
  return true;
}

export function weaponUnlocked(m: MetaSave, w: WeaponId) {
  return w === 'fangs' || has(m, 'w_' + w);
}

/** pushes meta unlocks into the systems that read them; returns run start options */
export function applyMeta(m: MetaSave) {
  const pats: PatronId[] = ['ember', 'rime', 'storm', 'tide'];
  if (has(m, 'p_dawn')) pats.push('dawn');
  if (has(m, 'p_gale')) pats.push('gale');
  if (has(m, 'p_umbra')) pats.push('umbra');
  if (has(m, 'p_thorn')) pats.push('thorn');
  PATRON_POOL.ids = pats;
  BOON_RULES.duos = has(m, 'concord');
  ENCOUNTER_CTX.tier = (has(m, 'deep1') ? 1 : 0) + (has(m, 'deep2') ? 1 : 0);
  ENCOUNTER_CTX.invaders = has(m, 'deep2');
  ELITE_POOL.bits = [ELITE.HASTE, ELITE.SHIELDED, ELITE.VOLATILE, ELITE.BLAZING, ELITE.HULKING, ELITE.VAMPIRIC, ELITE.MENDING];
  if (has(m, 'deep1')) ELITE_POOL.bits.push(ELITE.BLINKING, ELITE.ORBITING, ELITE.SPLITTING);
  const keepsake = m.keepsake && has(m, m.keepsake) ? KEEPSAKE_IDS[m.keepsake] : null;
  return {
    maxHpBonus: (has(m, 'heart1') ? 10 : 0) + (has(m, 'heart2') ? 10 : 0),
    deathDefiance: 1 + (has(m, 'defy2') ? 1 : 0),
    rerolls: 1 + (has(m, 'reroll2') ? 1 : 0),
    gold: has(m, 'purse') ? 40 : 0,
    keepsake,
    emberMul: 1 + ENCOUNTER_CTX.tier * 0.2,
  };
}
