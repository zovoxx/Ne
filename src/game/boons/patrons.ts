import type { BoonDef, PatronDef, PatronId } from './types';
import type { Stats } from '../stats';

/* ═══════════════════════ THE EIGHT LIGHTS ═══════════════════════
 * Spirits of dead stars bound to Wren's lantern. Each offers a style of play.
 */
export const PATRONS: Record<PatronId, PatronDef> = {
  ember: { id: 'ember', name: 'Ashka', title: 'the Kiln', color: 0xff7a2a, theme: 'Burn: stacking fire damage', unlock: 0, greet: ['Make them crackle, little wick.', 'Burn bright. Burn everything.', 'Ash remembers. Feed it.'] },
  rime: { id: 'rime', name: 'Ilvra', title: 'the Rime Widow', color: 0x8fe8ff, theme: 'Chill → Freeze → Shatter', unlock: 0, greet: ['Stillness is a gift. Give it freely.', 'Let them slow. Let them stop.', 'Cold is patient. So am I.'] },
  storm: { id: 'storm', name: 'Korr', title: 'the Thunder Ram', color: 0xffe24a, theme: 'Lightning that chains between foes', unlock: 0, greet: ['HA! Let it arc!', 'One strike, many cracks.', 'Charge them. All of them.'] },
  tide: { id: 'tide', name: 'Maelis', title: 'the Deep Tide', color: 0x3d9bff, theme: 'Knockback and wall slams', unlock: 0, greet: ['Push. Then push harder.', 'The deep returns all things to stone.', 'Let them break upon you.'] },
  dawn: { id: 'dawn', name: 'Solenne', title: 'the Dawnmother', color: 0xfff1a6, theme: 'Radiant marks and critical hits', unlock: 1, greet: ['Find the seam of light in them.', 'Every dawn begins with one bright cut.', 'Shine true, child.'] },
  umbra: { id: 'umbra', name: 'Oruun', title: 'the Hollow Eye', color: 0xb45cff, theme: 'Hex: curses that spread on death', unlock: 2, greet: ['Curses travel well.', 'Let the dark do the work.', 'One death, then another. Then another.'] },
  gale: { id: 'gale', name: 'Siffra', title: 'the Running Wind', color: 0x8dffc8, theme: 'Speed, dashes and wind blades', unlock: 1, greet: ['Faster! They can barely see you.', 'Never stop moving.', 'Ride me, little flame.'] },
  thorn: { id: 'thorn', name: 'Brakka', title: 'the Thornmother', color: 0x86e04a, theme: 'Bleed stacks that burst on heavy hits', unlock: 3, greet: ['Let them carry my thorns home.', 'Wound, then rend.', 'Every cut takes root.'] },
};

export const PATRON_ORDER: PatronId[] = ['ember', 'rime', 'storm', 'tide', 'dawn', 'gale', 'umbra', 'thorn'];

type SlotKey = 'attack' | 'special' | 'dash' | 'cast';

/** slot boon: infuses a slot with the patron's element (only one boon per slot) */
function slot(p: PatronId, sl: SlotKey, id: string, name: string, text: string, base: number[], fmt: string[], extra?: (s: Stats, v: number[]) => void): BoonDef {
  return {
    id,
    patron: p,
    name,
    slot: sl,
    text,
    base,
    fmt,
    apply(s, v) {
      s.infuse[sl] = p;
      s.infusePow[sl] = v[1] ?? 1;
      if (sl === 'attack') s.attackDmg += v[0];
      else if (sl === 'special') s.specialDmg += v[0];
      else if (sl === 'dash') s.dashDmg += v[0];
      else s.castDmg += v[0];
      extra?.(s, v);
    },
    weight: 1.4,
  };
}

function passive(p: PatronId, id: string, name: string, text: string, base: number[], fmt: string[], apply: (s: Stats, v: number[]) => void, weight = 1, free = false): BoonDef {
  return { id, patron: p, name, slot: 'passive', text, base, fmt, apply, weight, free };
}

/** requires at least one boon from the patron in an attack/special/cast/dash slot */
const needsPatron = (p: PatronId, n = 1) => (ctx: { patronCount: Map<string, number> }) => (ctx.patronCount.get(p) ?? 0) >= n;

/* ─────────────── ASHKA — EMBER ─────────────── */
const EMBER: BoonDef[] = [
  slot('ember', 'attack', 'ember_attack', 'Kiln Strike', 'Attacks deal +{0} damage and inflict {1} Burn.', [0.15, 2], ['%', '']),
  slot('ember', 'special', 'ember_special', 'Kiln Flourish', 'Your special deals +{0} damage and inflicts {1} Burn.', [0.25, 3], ['%', '']),
  slot('ember', 'dash', 'ember_dash', 'Cinder Step', 'Your dash leaves a trail of fire that inflicts Burn. Dash-strikes deal +{0} damage.', [0.2, 1], ['%', '']),
  slot('ember', 'cast', 'ember_cast', 'Kiln Sigil', 'Your Sigil deals +{0} damage and leaves a fire field for {1}.', [0.3, 3], ['%', 's'], (s, v) => s.add('emberCastField', v[1])),
  { id: 'ember_revenge', patron: 'ember', name: 'Backdraft', slot: 'revenge', text: 'When you are hit, erupt in flame for {0} damage and {1} Burn around you.', base: [24, 4], fmt: ['', ''], apply: (s, v) => { s.add('backdraft', v[0]); s.add('backdraftBurn', v[1]); }, weight: 0.8 },
  passive('ember', 'ember_stoked', 'Stoked', 'Burn deals {0} more damage.', [0.35], ['%'], (s, v) => (s.burnDps *= 1 + v[0]), 1),
  passive('ember', 'ember_wildfire', 'Wildfire', 'Burning enemies explode on death for {0} damage, spreading Burn.', [18], [''], (s, v) => s.add('wildfire', v[0])),
  passive('ember', 'ember_pyre', 'Fuel the Pyre', 'Deal {0} more damage to burning enemies.', [0.15], ['%'], (s, v) => s.add('vsBurn', v[0])),
  passive('ember', 'ember_hearth', 'Hearthkeeper', '+{0} max health. Heal {1} after each room.', [12, 5], ['', ''], (s, v) => {
    s.maxHp += v[0];
    s.healOnRoomClear += v[1];
  }, 0.9, true),
  passive('ember', 'ember_smolder', 'Smolder', 'Burn lasts longer and stacks up to {0} more.', [10], [''], (s, v) => {
    s.burnMax += v[0];
    s.burnDecay -= 0.06;
  }),
  { id: 'ember_crown', patron: 'ember', name: 'Inferno Crown', slot: 'legendary', text: 'LEGENDARY · Enemies take +{0} damage per Burn stack (max +40%).', base: [0.025], fmt: ['%'], fixed: [true], apply: (s, v) => s.add('infernoCrown', v[0]), req: needsPatron('ember', 2), weight: 0.6 },
];

/* ─────────────── ILVRA — RIME ─────────────── */
const RIME: BoonDef[] = [
  slot('rime', 'attack', 'rime_attack', 'Rime Strike', 'Attacks deal +{0} damage and inflict {1} Chill. 10 Chill freezes.', [0.12, 2], ['%', '']),
  slot('rime', 'special', 'rime_special', 'Rime Flourish', 'Your special deals +{0} damage and inflicts {1} Chill.', [0.22, 3], ['%', '']),
  slot('rime', 'dash', 'rime_dash', 'Frost Step', 'Your dash ends in a frost nova that inflicts {1} Chill. Dash-strikes +{0} damage.', [0.2, 3], ['%', '']),
  slot('rime', 'cast', 'rime_cast', 'Rime Sigil', 'Your Sigil deals +{0} damage and inflicts {1} Chill.', [0.25, 6], ['%', '']),
  { id: 'rime_revenge', patron: 'rime', name: 'Glacial Shell', slot: 'revenge', text: 'When you are hit, freeze your attacker and inflict {0} Chill nearby.', base: [4], fmt: [''], apply: (s, v) => s.add('glacialShell', v[0]), weight: 0.8 },
  passive('rime', 'rime_deep', 'Deep Cold', 'Freeze lasts {0} longer.', [0.5], ['s'], (s, v) => (s.freezeTime += v[0])),
  passive('rime', 'rime_shatter', 'Shatterpoint', 'Frozen enemies shatter on death for {0} damage around them.', [22], [''], (s, v) => (s.shatterDmg += v[0])),
  passive('rime', 'rime_brittle', 'Brittle', 'Frozen enemies take {0} more damage.', [0.25], ['%'], (s, v) => (s.freezeVuln += v[0])),
  passive('rime', 'rime_perma', 'Permafrost', 'Freezing needs {0} less Chill.', [2], [''], (s, v) => (s.chillMax -= v[0]), 0.8),
  passive('rime', 'rime_snap', 'Cold Snap', 'Each Chill stack slows {0} more.', [0.02], ['%'], (s, v) => (s.chillPerStack += v[0])),
  { id: 'rime_zero', patron: 'rime', name: 'Absolute Zero', slot: 'legendary', text: 'LEGENDARY · Freezing an enemy also freezes chilled enemies within {0} range.', base: [160], fmt: [''], fixed: [true], apply: (s, v) => s.add('absZero', v[0]), req: needsPatron('rime', 2), weight: 0.6 },
];

/* ─────────────── KORR — STORM ─────────────── */
const STORM: BoonDef[] = [
  slot('storm', 'attack', 'storm_attack', 'Thunder Strike', 'Attacks deal +{0} damage and arc lightning to nearby foes.', [0.12, 1], ['%', '']),
  slot('storm', 'special', 'storm_special', 'Thunder Flourish', 'Your special deals +{0} damage and arcs powerful lightning.', [0.2, 1.6], ['%', '']),
  slot('storm', 'dash', 'storm_dash', 'Storm Step', 'Dashing calls lightning on {1} nearby enemies. Dash-strikes +{0} damage.', [0.2, 2], ['%', '']),
  slot('storm', 'cast', 'storm_cast', 'Storm Sigil', 'Your Sigil deals +{0} damage and becomes a storm cloud striking for {1}.', [0.25, 3], ['%', 's'], (s, v) => s.add('stormCastCloud', v[1])),
  { id: 'storm_revenge', patron: 'storm', name: 'Static Retort', slot: 'revenge', text: 'When you are hit, lightning strikes your attacker and {0} others.', base: [3], fmt: [''], apply: (s, v) => s.add('staticRetort', v[0]), weight: 0.8 },
  passive('storm', 'storm_conductor', 'Conductor', 'Lightning chains to {0} more enemies.', [1], [''], (s, v) => (s.joltChains += v[0])),
  passive('storm', 'storm_voltage', 'High Voltage', 'Lightning deals {0} more damage.', [6], [''], (s, v) => (s.joltDmg += v[0])),
  passive('storm', 'storm_reach', 'Arc Reach', 'Lightning jumps {0} further.', [0.3], ['%'], (s, v) => s.add('arcReach', v[0])),
  passive('storm', 'storm_overcharge', 'Overcharge', 'Lightning has a {0} chance to critically strike.', [0.2], ['%'], (s, v) => s.add('overcharge', v[0])),
  passive('storm', 'storm_ionize', 'Ionize', 'Enemies struck by lightning take {0} more damage for 3s.', [0.12], ['%'], (s, v) => s.add('ionize', v[0])),
  { id: 'storm_head', patron: 'storm', name: 'Thunderhead', slot: 'legendary', text: 'LEGENDARY · Every 6th lightning strike calls down a thunderbolt for {0} area damage.', base: [60], fmt: [''], fixed: [true], apply: (s, v) => s.add('thunderhead', v[0]), req: needsPatron('storm', 2), weight: 0.6 },
];

export const BOONS: BoonDef[] = [...EMBER, ...RIME, ...STORM];

export function registerBoons(list: BoonDef[]) {
  for (const b of list) BOONS.push(b);
  rebuildIndex();
}

export const BOON_BY_ID: Record<string, BoonDef> = {};
export function rebuildIndex() {
  for (const k in BOON_BY_ID) delete BOON_BY_ID[k];
  for (const b of BOONS) BOON_BY_ID[b.id] = b;
}
rebuildIndex();
