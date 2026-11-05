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


/* ─────────────── MAELIS — TIDE ─────────────── */
const TIDE: BoonDef[] = [
  slot('tide', 'attack', 'tide_attack', 'Tide Strike', 'Attacks deal +{0} damage and knock foes back. Enemies slammed into walls take extra damage.', [0.15, 1], ['%', '']),
  slot('tide', 'special', 'tide_special', 'Tide Flourish', 'Your special deals +{0} damage and hurls enemies away.', [0.25, 1.8], ['%', '']),
  slot('tide', 'dash', 'tide_dash', 'Undertow Step', 'Your dash ends in a wave that shoves enemies away for {1} damage. Dash-strikes +{0}.', [0.2, 12], ['%', '']),
  slot('tide', 'cast', 'tide_cast', 'Tide Sigil', 'Your Sigil deals +{0} damage and blasts enemies outward into walls.', [0.3, 1], ['%', ''], (s) => s.add('tideCast', 1)),
  { id: 'tide_revenge', patron: 'tide', name: 'Breakwater', slot: 'revenge', text: 'When you are hit, gain a {0}-point barrier and push nearby enemies away.', base: [12], fmt: [''], apply: (s, v) => s.add('breakwater', v[0]), weight: 0.8 },
  passive('tide', 'tide_crash', 'Crashing Surf', 'Wall slams deal {0} more damage.', [14], [''], (s, v) => (s.tideSlamDmg += v[0])),
  passive('tide', 'tide_riptide', 'Riptide', 'Enemies you knock back damage the foes they crash into for {0}.', [14], [''], (s, v) => s.add('riptide', v[0])),
  passive('tide', 'tide_swell', 'Swell', '+{0} max health.', [16], [''], (s, v) => (s.maxHp += v[0]), 0.9, true),
  passive('tide', 'tide_legs', 'Sea Legs', 'Move {0} faster.', [0.08], ['%'], (s, v) => (s.moveSpeed += v[0]), 0.9, true),
  passive('tide', 'tide_ebb', 'Ebb and Flow', 'Heal {0} after every room.', [7], [''], (s, v) => (s.healOnRoomClear += v[0]), 0.9, true),
  { id: 'tide_heart', patron: 'tide', name: 'Maelstrom Heart', slot: 'legendary', text: 'LEGENDARY · Every {0}s a whirlpool opens at your feet, dragging enemies in.', base: [4], fmt: [''], fixed: [true], apply: (s, v) => s.add('maelHeart', v[0]), req: needsPatron('tide', 2), weight: 0.6 },
];

/* ─────────────── SOLENNE — DAWN ─────────────── */
const DAWN: BoonDef[] = [
  slot('dawn', 'attack', 'dawn_attack', 'Dawn Strike', 'Attacks deal +{0} damage and Mark foes. Marked foes are critically hit far more often.', [0.12, 1], ['%', '']),
  slot('dawn', 'special', 'dawn_special', 'Dawn Flourish', 'Your special deals +{0} damage, Marks foes and has +{1} crit chance.', [0.2, 0.15], ['%', '%'], (s, v) => s.add('dawnSpecialCrit', v[1])),
  slot('dawn', 'dash', 'dawn_dash', 'Daybreak', 'After you dash, your next attack is a critical hit. Dash-strikes +{0}.', [0.2, 1], ['%', ''], (s) => s.add('dawnDash', 1)),
  slot('dawn', 'cast', 'dawn_cast', 'Dawn Sigil', 'Your Sigil deals +{0} damage and leaves radiance that Marks foes for {1}.', [0.3, 3], ['%', 's'], (s, v) => s.add('dawnCast', v[1])),
  { id: 'dawn_revenge', patron: 'dawn', name: 'Mercy’s Glare', slot: 'revenge', text: 'When you are hit, heal {0} and blind nearby enemies for 1s.', base: [4], fmt: [''], apply: (s, v) => s.add('mercy', v[0]), weight: 0.8 },
  passive('dawn', 'dawn_clarity', 'Clarity', '+{0} critical chance.', [0.06], ['%'], (s, v) => (s.critChance += v[0]), 1, true),
  passive('dawn', 'dawn_sunburst', 'Sunburst', 'Critical hits deal +{0} damage.', [0.5], ['%'], (s, v) => (s.critMul += v[0]), 1, true),
  passive('dawn', 'dawn_glare', 'Glare', 'Crits on Marked foes spread the Mark to {0} nearby enemies.', [2], [''], (s, v) => s.add('glare', v[0])),
  passive('dawn', 'dawn_morning', 'Morning Star', 'Critical hits burst with light for {0} damage around the target.', [12], [''], (s, v) => s.add('morningStar', v[0])),
  passive('dawn', 'dawn_grace', 'Grace', '{0} chance to avoid damage entirely.', [0.06], ['%'], (s, v) => (s.dodge += v[0]), 0.9, true),
  { id: 'dawn_zenith', patron: 'dawn', name: 'Zenith', slot: 'legendary', text: 'LEGENDARY · Your first hit on every enemy is a critical hit.', base: [1], fmt: [''], fixed: [true], apply: (s) => s.add('zenith', 1), req: needsPatron('dawn', 2), weight: 0.6 },
];

/* ─────────────── ORUUN — UMBRA ─────────────── */
const hexOn = (s: Stats) => s.add('hexOn', 1);
const UMBRA: BoonDef[] = [
  slot('umbra', 'attack', 'umbra_attack', 'Hex Strike', 'Attacks deal +{0} damage and Hex foes. Hexed foes take more damage and burst on death, spreading the Hex.', [0.12, 1], ['%', ''], hexOn),
  slot('umbra', 'special', 'umbra_special', 'Hex Flourish', 'Your special deals +{0} damage and Hexes foes.', [0.22, 1], ['%', ''], hexOn),
  slot('umbra', 'dash', 'umbra_dash', 'Shade Step', 'Enemies you dash through are Hexed and take damage. Dash-strikes +{0}.', [0.25, 1], ['%', ''], hexOn),
  slot('umbra', 'cast', 'umbra_cast', 'Hex Sigil', 'Your Sigil deals +{0} damage, Hexes foes and drags them inward.', [0.25, 1], ['%', ''], (s) => {
    hexOn(s);
    s.add('umbraCast', 1);
  }),
  { id: 'umbra_revenge', patron: 'umbra', name: 'Umbral Recoil', slot: 'revenge', text: 'When you are hit, Hex every enemy within {0} range.', base: [230], fmt: [''], fixed: [true], apply: (s, v) => {
    hexOn(s);
    s.add('umbralRecoil', v[0]);
  }, weight: 0.8 },
  passive('umbra', 'umbra_contagion', 'Contagion', 'Hex spreads to {0} more enemies on death.', [1], [''], (s, v) => (s.hexSpread += v[0])),
  passive('umbra', 'umbra_doom', 'Doom', 'Hex death bursts deal {0} more damage.', [16], [''], (s, v) => (s.hexBurst += v[0])),
  passive('umbra', 'umbra_wither', 'Wither', 'Hexed foes take {0} more damage.', [0.12], ['%'], (s, v) => (s.hexDmgTaken += v[0])),
  passive('umbra', 'umbra_siphon', 'Soul Siphon', 'Heal {0} whenever a Hexed foe dies.', [2], [''], (s, v) => s.add('siphon', v[0])),
  passive('umbra', 'umbra_dread', 'Dread', 'Hexed foes move and attack {0} slower.', [0.25], ['%'], (s, v) => s.add('dread', v[0])),
  { id: 'umbra_sun', patron: 'umbra', name: 'Black Sun', slot: 'legendary', text: 'LEGENDARY · Hexed deaths have a {0} chance to restore a Sigil charge.', base: [0.3], fmt: ['%'], fixed: [true], apply: (s, v) => s.add('blackSun', v[0]), req: needsPatron('umbra', 2), weight: 0.6 },
];

/* ─────────────── SIFFRA — GALE ─────────────── */
const GALE: BoonDef[] = [
  slot('gale', 'attack', 'gale_attack', 'Gale Strike', 'Attacks are {0} faster and buffet foes, slowing them.', [0.12, 1], ['%', ''], (s, v) => {
    s.attackDmg -= v[0];
    s.attackSpeed += v[0];
  }),
  slot('gale', 'special', 'gale_special', 'Gale Flourish', 'Your special deals +{0} damage and looses {1} wind blades.', [0.2, 2], ['%', ''], (s, v) => s.add('galeSpecial', v[1])),
  slot('gale', 'dash', 'gale_dash', 'Tailwind', '+1 dash charge. Dashing looses 3 wind blades ahead of you. Dash-strikes +{0}.', [0.2, 1], ['%', ''], (s) => {
    s.dashCharges += 1;
    s.add('galeDash', 1);
  }),
  slot('gale', 'cast', 'gale_cast', 'Gale Sigil', 'Your Sigil deals +{0} damage and spins up a roaming cyclone for {1}.', [0.25, 3], ['%', 's'], (s, v) => s.add('galeCast', v[1])),
  { id: 'gale_revenge', patron: 'gale', name: 'Updraft', slot: 'revenge', text: 'When you are hit, move {0} faster and dodge more for 2s.', base: [0.4], fmt: ['%'], apply: (s, v) => s.add('updraft', v[0]), weight: 0.8 },
  passive('gale', 'gale_fleet', 'Fleetfoot', 'Move {0} faster.', [0.1], ['%'], (s, v) => (s.moveSpeed += v[0]), 1, true),
  passive('gale', 'gale_quick', 'Quickstep', 'Dash recovers {0} faster.', [0.2], ['%'], (s, v) => (s.dashCooldown -= v[0]), 1, true),
  passive('gale', 'gale_second', 'Second Wind', '+1 dash charge.', [1], [''], (s) => (s.dashCharges += 1), 0.8, true),
  passive('gale', 'gale_slip', 'Slipstream', 'For 1s after dashing you deal {0} more damage.', [0.2], ['%'], (s, v) => s.add('slipstream', v[0]), 1, true),
  passive('gale', 'gale_feather', 'Featherfall', '{0} chance to avoid damage entirely.', [0.06], ['%'], (s, v) => (s.dodge += v[0]), 0.9, true),
  { id: 'gale_eye', patron: 'gale', name: 'Eye of the Storm', slot: 'legendary', text: 'LEGENDARY · Dashing through an enemy looses wind blades at {0} nearby foes.', base: [3], fmt: [''], fixed: [true], apply: (s, v) => s.add('eyeStorm', v[0]), req: needsPatron('gale', 2), weight: 0.6 },
];

/* ─────────────── BRAKKA — THORN ─────────────── */
const THORN: BoonDef[] = [
  slot('thorn', 'attack', 'thorn_attack', 'Thorn Strike', 'Attacks deal +{0} damage and inflict {1} Bleed. Specials, finishers and Sigils burst Bleed for big damage.', [0.12, 1], ['%', '']),
  slot('thorn', 'special', 'thorn_special', 'Thorn Flourish', 'Your special deals +{0} damage and inflicts {1} Bleed before bursting it.', [0.25, 2], ['%', '']),
  slot('thorn', 'dash', 'thorn_dash', 'Bramble Step', 'Your dash scatters caltrops that inflict Bleed and slow. Dash-strikes +{0}.', [0.2, 1], ['%', ''], (s) => s.add('thornDash', 1)),
  slot('thorn', 'cast', 'thorn_cast', 'Thorn Sigil', 'Your Sigil deals +{0} damage and grows a bramble patch for {1}.', [0.25, 3], ['%', 's'], (s, v) => s.add('thornCast', v[1])),
  { id: 'thorn_revenge', patron: 'thorn', name: 'Barbed Hide', slot: 'revenge', text: 'When you are hit, your attacker takes {0} damage and starts to Bleed.', base: [22], fmt: [''], apply: (s, v) => s.add('barbed', v[0]), weight: 0.8 },
  passive('thorn', 'thorn_lacerate', 'Lacerate', 'Bleed bursts deal {0} more damage per stack.', [3], [''], (s, v) => (s.bleedBurst += v[0])),
  passive('thorn', 'thorn_deep', 'Deep Wounds', 'Bleed stacks up to {0} higher.', [6], [''], (s, v) => (s.bleedMax += v[0])),
  passive('thorn', 'thorn_letting', 'Bloodletting', 'Heal {0} whenever Bleed bursts.', [1], [''], (s, v) => s.add('bloodletting', v[0])),
  passive('thorn', 'thorn_rending', 'Rending', 'Deal {0} more damage to bleeding foes.', [0.15], ['%'], (s, v) => s.add('rending', v[0])),
  passive('thorn', 'thorn_bark', 'Thick Bark', '+{0} max health and take {1} less damage.', [10, 0.06], ['', '%'], (s, v) => {
    s.maxHp += v[0];
    s.damageTaken -= v[1];
  }, 0.9, true),
  { id: 'thorn_thousand', patron: 'thorn', name: 'Thousand Thorns', slot: 'legendary', text: 'LEGENDARY · Bleed bursts spread half their stacks to {0} nearby foes.', base: [3], fmt: [''], fixed: [true], apply: (s, v) => s.add('thousandThorns', v[0]), req: needsPatron('thorn', 2), weight: 0.6 },
];

/* ─────────────── DUO BOONS — two Lights in concert ─────────────── */
function duo(a: PatronId, b: PatronId, id: string, name: string, text: string, base: number[], fmt: string[], apply: (s: Stats, v: number[]) => void): BoonDef {
  return { id, patron: 'duo', duo: [a, b], name, slot: 'duo', text, base, fmt, fixed: base.map(() => true), apply, weight: 1.2 };
}
const DUOS: BoonDef[] = [
  duo('ember', 'rime', 'duo_steam', 'Steam Burst', 'Burning enemies that freeze explode in scalding steam for Burn × {0} damage.', [6], [''], (s, v) => s.add('steam', v[0])),
  duo('ember', 'storm', 'duo_plasma', 'Plasma Arc', 'Lightning inflicts {0} Burn and chains to 1 more foe.', [2], [''], (s, v) => {
    s.add('plasma', v[0]);
    s.joltChains += 1;
  }),
  duo('ember', 'tide', 'duo_boiling', 'Boiling Tide', 'Enemies slammed into walls erupt in flame for {0} damage.', [26], [''], (s, v) => s.add('boiling', v[0])),
  duo('ember', 'dawn', 'duo_flare', 'Solar Flare', 'Crits inflict {0} Burn, and burning foes are critically hit 12% more often.', [3], [''], (s, v) => s.add('solarFlare', v[0])),
  duo('ember', 'thorn', 'duo_wildthorn', 'Wildthorn', 'Bleed bursts set the target ablaze with Burn equal to the stacks burst.', [1], [''], (s) => s.add('wildthorn', 1)),
  duo('rime', 'storm', 'duo_static', 'Static Frost', 'Lightning inflicts {0} Chill and deals 40% more to frozen foes.', [2], [''], (s, v) => s.add('staticFrost', v[0])),
  duo('rime', 'tide', 'duo_glacier', 'Glacial Wave', 'Enemies slammed into walls are frozen solid.', [1], [''], (s) => s.add('glacier', 1)),
  duo('rime', 'umbra', 'duo_blackice', 'Black Ice', 'Hexed foes freeze with half the Chill.', [1], [''], (s) => s.add('blackIce', 1)),
  duo('storm', 'tide', 'duo_thunderwave', 'Thunderwave', 'Wall slams release chain lightning.', [1], [''], (s) => s.add('thunderwave', 1)),
  duo('storm', 'gale', 'duo_ride', 'Ride the Lightning', 'Dashing through foes arcs lightning, and every arc recharges your dash a little.', [1], [''], (s) => s.add('rideLightning', 1)),
  duo('storm', 'umbra', 'duo_blackstatic', 'Black Static', 'Hexed foes arc lightning to each other every second for {0} damage.', [9], [''], (s, v) => s.add('blackStatic', v[0])),
  duo('dawn', 'umbra', 'duo_eclipse', 'Eclipse', 'Hexed foes are critically hit 15% more often, and crits spread the Hex.', [1], [''], (s) => s.add('eclipse', 1)),
  duo('dawn', 'gale', 'duo_sunstreak', 'Sunstreak', 'After dashing, your next {0} attacks are critical hits.', [2], [''], (s, v) => s.add('sunstreak', v[0])),
  duo('dawn', 'thorn', 'duo_sunlit', 'Sunlit Wounds', 'Each Bleed stack gives +3% critical chance against that foe.', [0.03], ['%'], (s, v) => s.add('sunlit', v[0])),
  duo('umbra', 'thorn', 'duo_bloodmoon', 'Blood Moon', 'Bleed bursts Hex the target and heal you {0}.', [2], [''], (s, v) => s.add('bloodMoon', v[0])),
  duo('gale', 'thorn', 'duo_cuts', 'Thousand Cuts', 'Wind blades and dash hits inflict {0} Bleed.', [2], [''], (s, v) => s.add('cuts', v[0])),
  duo('gale', 'tide', 'duo_maelstrom', 'Maelstrom', 'Your Sigil becomes a roaming maelstrom that drags and batters foes.', [1], [''], (s) => s.add('maelstrom', 1)),
  duo('tide', 'umbra', 'duo_drowned', 'Drowned Curse', 'Hexed foes that die open a whirlpool that drags others in.', [1], [''], (s) => s.add('drowned', 1)),
];

export const BOONS: BoonDef[] = [...EMBER, ...RIME, ...STORM, ...TIDE, ...DAWN, ...UMBRA, ...GALE, ...THORN, ...DUOS];

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
