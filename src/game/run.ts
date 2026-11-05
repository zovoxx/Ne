import { TUNING } from '../config/tuning';
import type { Game } from './game';
import { Stats } from './stats';
import { BOON_BY_ID, BOONS, PATRONS } from './boons/patrons';
import { boonText, boonValues, RARITY_COLORS, RARITY_NAMES, type BoonContext, type BoonDef, type BoonSlot, type OwnedBoon, type PatronId } from './boons/types';
import type { RNG } from './math';
import { weaponById } from './weapons';
import type { WeaponId } from './weapons/types';

export type RoomType = 'combat' | 'elite' | 'mini' | 'boss' | 'shop' | 'spring' | 'ordeal';
export type RewardKind = 'boon' | 'forge' | 'kindle' | 'heart' | 'gold' | 'none';

export interface RoomPlan {
  type: RoomType;
  biome: number;
  step: number;
  reward: RewardKind;
  patron?: PatronId;
  /** reward rarity bonus (elite / miniboss rooms) */
  rarity?: number;
  seed: number;
  ordeal?: string;
}

export interface RunState {
  seed: number;
  weapon: WeaponId;
  boons: OwnedBoon[];
  forges: Record<string, number>;
  hp: number;
  maxHpBase: number;
  gold: number;
  biome: number;
  step: number;
  deathDefiance: number;
  rerolls: number;
  kills: number;
  time: number;
  rooms: number;
  bestStreak: number;
  bossesKilled: number;
  embers: number;
  keepsake: string | null;
  bonus: Record<string, number>;
  current: RoomPlan | null;
  history: RoomType[];
  shopsThisBiome: number;
  /** "glass pact" etc. */
  curse: Record<string, number>;
  won: boolean;
  lastMini?: string;
}

export function newRun(seed: number, weapon: WeaponId, opts: { maxHpBonus: number; deathDefiance: number; rerolls: number; gold: number; keepsake: string | null }): RunState {
  return {
    seed,
    weapon,
    boons: [],
    forges: {},
    hp: TUNING.player.maxHp + opts.maxHpBonus,
    maxHpBase: TUNING.player.maxHp + opts.maxHpBonus,
    gold: opts.gold,
    biome: 0,
    step: 0,
    deathDefiance: opts.deathDefiance,
    rerolls: opts.rerolls,
    kills: 0,
    time: 0,
    rooms: 0,
    bestStreak: 0,
    bossesKilled: 0,
    embers: 0,
    keepsake: opts.keepsake,
    bonus: {},
    current: null,
    history: [],
    shopsThisBiome: 0,
    curse: {},
    won: false,
  };
}

/** rules toggled by meta progression */
export const BOON_RULES = { duos: true };

/** meta-progression hook: lets save.ts add permanent bonuses into the stat rebuild */
export const META_HOOK: { apply: ((s: Stats) => void) | null } = { apply: null };

/** Rebuild Stats from scratch from the run's boons, forges and bonuses. */
export function recomputeStats(g: Game, run: RunState) {
  const s = new Stats();
  for (const ob of run.boons) {
    const def = BOON_BY_ID[ob.id];
    if (!def) continue;
    def.apply(s, boonValues(def, ob.rarity, ob.level));
  }
  for (const id in run.forges) {
    const n = run.forges[id];
    const f = GENERIC_FORGES.find((x) => x.id === id);
    if (f) f.apply(s, n);
    else s.add(id, n);
  }
  const b = run.bonus;
  if (b.dmg) s.allDmg += b.dmg;
  if (b.maxHp) s.maxHp += b.maxHp;
  if (b.speed) s.moveSpeed += b.speed;
  if (b.crit) s.critChance += b.crit;
  if (run.curse.glass) s.damageTaken += 1;
  if (run.keepsake === 'charm') s.critChance += 0.05;
  if (run.keepsake === 'feather') s.moveSpeed += 0.08;
  if (run.keepsake === 'locket') s.maxHp += 15;
  if (run.keepsake === 'whetstone') s.attackDmg += 0.1;
  META_HOOK.apply?.(s);
  g.stats = s;
  const p = g.player;
  const newMax = run.maxHpBase + s.maxHp;
  if (newMax > p.maxHp) p.hp += newMax - p.maxHp;
  p.maxHp = newMax;
  p.hp = Math.min(p.hp, p.maxHp);
  run.hp = p.hp;
}

/* ═══════════════════════ OFFERS (choose 1 of 3) ═══════════════════════ */

export interface OfferOption {
  kind: 'boon' | 'forge' | 'kindle' | 'heart' | 'gold' | 'misc';
  id: string;
  name: string;
  desc: string;
  tag: string;
  rarity: number;
  color: number;
  icon: string;
  replaces?: string;
  apply(): void;
}

export interface Offer {
  title: string;
  subtitle: string;
  color: number;
  options: OfferOption[];
  reroll?: () => Offer | null;
}

function ctxOf(run: RunState): BoonContext {
  const owned = new Map<string, OwnedBoon>();
  const patronCount = new Map<string, number>();
  const slots = new Map<BoonSlot, string>();
  for (const ob of run.boons) {
    const def = BOON_BY_ID[ob.id];
    if (!def) continue;
    owned.set(ob.id, ob);
    if (def.patron !== 'duo') patronCount.set(def.patron, (patronCount.get(def.patron) ?? 0) + 1);
    if (def.slot !== 'passive' && def.slot !== 'legendary' && def.slot !== 'duo') slots.set(def.slot, ob.id);
  }
  return { owned, patronCount, slots };
}

function hasCoreBoon(run: RunState, patron: PatronId) {
  return run.boons.some((ob) => {
    const d = BOON_BY_ID[ob.id];
    return d && d.patron === patron && (d.slot === 'attack' || d.slot === 'special' || d.slot === 'dash' || d.slot === 'cast');
  });
}

export function eligibleBoons(run: RunState, patron: PatronId): BoonDef[] {
  const ctx = ctxOf(run);
  const out: BoonDef[] = [];
  for (const def of BOONS) {
    if (ctx.owned.has(def.id)) continue;
    if (def.duo) {
      if (!BOON_RULES.duos) continue;
      if (!def.duo.includes(patron)) continue;
      if (!hasCoreBoon(run, def.duo[0]) || !hasCoreBoon(run, def.duo[1])) continue;
      if (def.req && !def.req(ctx)) continue;
      out.push(def);
      continue;
    }
    if (def.patron !== patron) continue;
    if (def.req && !def.req(ctx)) continue;
    if (def.slot === 'passive' && !def.free && !hasCoreBoon(run, patron)) continue;
    out.push(def);
  }
  return out;
}

export function rollRarity(rng: RNG, bonus: number) {
  const base = [0.6, 0.27, 0.1, 0.03];
  const w = base.slice();
  for (let i = 0; i < bonus; i++) {
    // shift weight up one tier
    for (let k = 3; k > 0; k--) {
      const move = w[k - 1] * 0.55;
      w[k] += move;
      w[k - 1] -= move;
    }
  }
  let r = rng.next();
  for (let i = 0; i < 4; i++) {
    r -= w[i];
    if (r <= 0) return i;
  }
  return 0;
}

function boonOption(g: Game, run: RunState, def: BoonDef, rarity: number, onPick: () => void): OfferOption {
  const r = def.slot === 'legendary' ? 3 : def.duo ? 2 : rarity;
  const v = boonValues(def, def.slot === 'legendary' || def.duo ? 0 : r, 1);
  const ctx = ctxOf(run);
  let replaces: string | undefined;
  if (def.slot !== 'passive' && def.slot !== 'legendary' && def.slot !== 'duo') {
    const cur = ctx.slots.get(def.slot);
    if (cur) replaces = BOON_BY_ID[cur]?.name;
  }
  const patron = def.duo ? PATRONS[def.duo[0]] : PATRONS[def.patron as PatronId];
  const tag = def.duo ? `DUO · ${PATRONS[def.duo[0]].name} + ${PATRONS[def.duo[1]].name}` : def.slot === 'legendary' ? 'LEGENDARY' : `${RARITY_NAMES[r]} · ${def.slot.toUpperCase()}`;
  return {
    kind: 'boon',
    id: def.id,
    name: def.name,
    desc: boonText(def, v),
    tag,
    rarity: r,
    color: patron.color,
    icon: def.slot,
    replaces,
    apply() {
      // slot boons replace whatever occupied the slot
      if (def.slot !== 'passive' && def.slot !== 'legendary' && def.slot !== 'duo') {
        run.boons = run.boons.filter((ob) => BOON_BY_ID[ob.id]?.slot !== def.slot);
      }
      run.boons.push({ id: def.id, rarity: def.slot === 'legendary' || def.duo ? 0 : r, level: 1 });
      recomputeStats(g, run);
      onPick();
    },
  };
}

export function boonOffer(g: Game, run: RunState, patron: PatronId, rarityBonus: number, onPick: () => void): Offer {
  const rng = g.rng;
  const pool = eligibleBoons(run, patron);
  const picks: BoonDef[] = [];
  const ctx = ctxOf(run);
  const weightOf = (d: BoonDef) => {
    let w = d.weight ?? 1;
    // early in a run, favour filling empty attack/special slots
    if ((d.slot === 'attack' || d.slot === 'special') && !ctx.slots.has(d.slot)) w *= 2.2;
    if (d.duo) w *= 1.6;
    return w;
  };
  while (picks.length < 3 && pool.length) {
    const d = rng.weighted(pool, weightOf)!;
    picks.push(d);
    pool.splice(pool.indexOf(d), 1);
  }
  const P = PATRONS[patron];
  const offer: Offer = {
    title: `${P.name}, ${P.title}`,
    subtitle: rng.pick(P.greet),
    color: P.color,
    options: picks.map((d) => boonOption(g, run, d, rollRarity(rng, rarityBonus), onPick)),
  };
  if (!offer.options.length) return heartOffer(g, run, onPick);
  if (run.rerolls > 0)
    offer.reroll = () => {
      run.rerolls--;
      return boonOffer(g, run, patron, rarityBonus, onPick);
    };
  return offer;
}

/* weapon forge upgrades (generic + weapon-specific) */
export const GENERIC_FORGES = [
  { id: 'gHoned', name: 'Honed Edge', desc: 'Attacks deal +15% damage.', max: 3, apply: (s: Stats, n: number) => (s.attackDmg += 0.15 * n) },
  { id: 'gTempered', name: 'Tempered Core', desc: 'Specials deal +20% damage.', max: 3, apply: (s: Stats, n: number) => (s.specialDmg += 0.2 * n) },
  { id: 'gQuick', name: 'Quickened Grip', desc: 'Attack +10% faster.', max: 2, apply: (s: Stats, n: number) => (s.attackSpeed += 0.1 * n) },
  { id: 'gKeen', name: 'Keen Eye', desc: '+6% critical chance.', max: 3, apply: (s: Stats, n: number) => (s.critChance += 0.06 * n) },
  { id: 'gSigil', name: 'Deep Sigil', desc: 'Sigil +1 charge and +15% radius.', max: 1, apply: (s: Stats, n: number) => {
    s.castCharges += n;
    s.castRadius += 0.15 * n;
  } },
];

export function forgeOffer(g: Game, run: RunState, onPick: () => void): Offer {
  const w = weaponById(run.weapon);
  const rng = g.rng;
  const specific = w.forges.filter((f) => (run.forges[f.id] ?? 0) < f.max);
  const generic = GENERIC_FORGES.filter((f) => (run.forges[f.id] ?? 0) < f.max);
  const picks: { id: string; name: string; desc: string }[] = [];
  rng.shuffle(specific);
  rng.shuffle(generic);
  while (picks.length < 2 && specific.length) picks.push(specific.shift()!);
  while (picks.length < 3 && generic.length) picks.push(generic.shift()!);
  while (picks.length < 3 && specific.length) picks.push(specific.shift()!);
  const offer: Offer = {
    title: 'The Forge-Spark',
    subtitle: `Temper your ${w.name}.`,
    color: 0xffb347,
    options: picks.map((f) => ({
      kind: 'forge' as const,
      id: f.id,
      name: f.name,
      desc: f.desc,
      tag: `FORGE · ${(run.forges[f.id] ?? 0) + 1}`,
      rarity: 1,
      color: 0xffb347,
      icon: 'forge',
      apply() {
        run.forges[f.id] = (run.forges[f.id] ?? 0) + 1;
        recomputeStats(g, run);
        onPick();
      },
    })),
  };
  if (!offer.options.length) return goldOffer(g, run, onPick);
  return offer;
}

export function kindleOffer(g: Game, run: RunState, onPick: () => void): Offer {
  const rng = g.rng;
  const owned = run.boons.filter((ob) => BOON_BY_ID[ob.id] && ob.level < 6);
  if (owned.length === 0) return heartOffer(g, run, onPick);
  rng.shuffle(owned);
  const options: OfferOption[] = owned.slice(0, 3).map((ob) => {
    const def = BOON_BY_ID[ob.id];
    const cur = boonValues(def, ob.rarity, ob.level);
    const nxt = boonValues(def, ob.rarity, ob.level + 1);
    const patron = def.duo ? PATRONS[def.duo[0]] : PATRONS[def.patron as PatronId];
    const changed = def.fixed?.every((f) => f) ? 'Rarity +1' : boonText(def, nxt);
    return {
      kind: 'kindle' as const,
      id: ob.id,
      name: `${def.name} → Lv ${ob.level + 1}`,
      desc: changed,
      tag: `KINDLE · ${RARITY_NAMES[ob.rarity]}`,
      rarity: ob.rarity,
      color: patron.color,
      icon: def.slot,
      apply() {
        if (def.fixed?.every((f) => f)) ob.rarity = Math.min(3, ob.rarity + 1);
        ob.level++;
        recomputeStats(g, run);
        onPick();
      },
      _cur: cur,
    } as OfferOption;
  });
  return { title: 'Kindling', subtitle: 'Feed a light you already carry.', color: 0xffd27a, options };
}

export function heartOffer(g: Game, run: RunState, onPick: () => void): Offer {
  const p = g.player;
  return {
    title: 'Heartwood',
    subtitle: 'Something warm grows here.',
    color: 0xff5d7a,
    options: [
      {
        kind: 'heart',
        id: 'vital',
        name: 'Vitality',
        desc: '+18 max health and heal 18.',
        tag: 'HEART',
        rarity: 1,
        color: 0xff5d7a,
        icon: 'heart',
        apply() {
          run.maxHpBase += 18;
          recomputeStats(g, run);
          g.healPlayer(18);
          onPick();
        },
      },
      {
        kind: 'heart',
        id: 'mend',
        name: 'Mend',
        desc: `Heal ${Math.round(p.maxHp * 0.5)} health (50%).`,
        tag: 'HEART',
        rarity: 0,
        color: 0x5dff9a,
        icon: 'heal',
        apply() {
          g.healPlayer(p.maxHp * 0.5);
          onPick();
        },
      },
      {
        kind: 'heart',
        id: 'sap',
        name: 'Ember Sap',
        desc: '+8 max health, heal 20% and +25 gold.',
        tag: 'HEART',
        rarity: 0,
        color: 0xffd27a,
        icon: 'heart',
        apply() {
          run.maxHpBase += 8;
          recomputeStats(g, run);
          g.healPlayer(p.maxHp * 0.2);
          g.gold += 25;
          onPick();
        },
      },
    ],
  };
}

export function goldOffer(g: Game, run: RunState, onPick: () => void): Offer {
  const rng = g.rng;
  const scale = 1 + run.biome * 0.35;
  return {
    title: 'A Moth-Merchant’s Purse',
    subtitle: 'Coins hum when you hold them.',
    color: 0xffd166,
    options: [
      { kind: 'gold', id: 'purse', name: 'Full Purse', desc: `+${Math.round(70 * scale)} gold.`, tag: 'GOLD', rarity: 0, color: 0xffd166, icon: 'gold', apply() {
        g.gold += Math.round(70 * scale);
        onPick();
      } },
      { kind: 'gold', id: 'tithe', name: 'Tithe', desc: `+${Math.round(40 * scale)} gold and heal 15.`, tag: 'GOLD', rarity: 0, color: 0xffd166, icon: 'gold', apply() {
        g.gold += Math.round(40 * scale);
        g.healPlayer(15);
        onPick();
      } },
      { kind: 'gold', id: 'gamble', name: 'Coin Flip', desc: `50%: +${Math.round(150 * scale)} gold. 50%: +${Math.round(10 * scale)}.`, tag: 'GAMBLE', rarity: 2, color: 0xc07bff, icon: 'gold', apply() {
        g.gold += rng.chance(0.5) ? Math.round(150 * scale) : Math.round(10 * scale);
        onPick();
      } },
    ],
  };
}

export const RARITY = { names: RARITY_NAMES, colors: RARITY_COLORS };
