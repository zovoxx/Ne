import { TUNING } from '../../config/tuning';
import { EV } from '../events';
import { lerp } from '../math';
import { addPulse } from '../hazards';
import { TEAM_PLAYER } from '../entities';
import { F_LAUNCH, meleeArc, meleeCircle, meleeRect, nextComboStep } from './common';
import type { ActionSpec, Weapon } from './types';

const W = TUNING.weapons.anvil;

/** Anvilheart — a molten maul. Slow, huge hits, breaks armor. Special: hold to charge a fissure. */
const comboSpecs: ActionSpec[] = W.combo.map((c, i) => {
  const finisher = i === W.combo.length - 1;
  const spec: ActionSpec = {
    id: 'anvil' + i,
    kind: 'attack',
    step: i,
    finisher,
    windup: c.windup,
    active: c.active,
    recovery: c.recovery,
    moveMul: finisher ? 0.15 : 0.35,
    lunge: c.lunge,
    track: true,
    chainAt: 0.4,
    active_(g, p) {
      const wide = 1 + g.stats.val('anvilWide') * 0.25;
      const h = meleeArc(g, p, 'attack', p.actAngle, c.range * wide, c.arc, c.dmg, c.power, c.knock, c.active, finisher ? F_LAUNCH : 0, i, finisher, finisher ? 2 : i % 2);
      h.armorMul = W.armorBreakMul;
      if (finisher) {
        const ev = g.events.push(EV.Slam, p.x, p.y);
        ev.power = 1;
        ev.color = 0xffb347;
        if (g.stats.has('anvilEarthsplit')) {
          // a damaging shockwave ring that rolls outward
          const ring = addPulse(g, p.x, p.y, 300, 0.45, 0, 0xffb347, null, 30);
          ring.team = TEAM_PLAYER;
          meleeCircle(g, p, 'attack', p.x, p.y, 240, c.dmg * 0.45, 0.5, 1.2, 0.08, 0).armorMul = W.armorBreakMul;
        }
      }
    },
  };
  return spec;
});

const special: ActionSpec = {
  id: 'anvilQuake',
  kind: 'special',
  windup: 0.06,
  active: 0.1,
  recovery: 0.26,
  moveMul: 0.2,
  hold: 'special',
  holdMax: 1.6,
  holdMoveMul: 0.35,
  track: true,
  chainAt: 0.3,
  start(g, p) {
    p.ws.charge = 0;
    p.ws.readyPinged = 0;
  },
  holdTick(g, p) {
    const S = W.special;
    const k = Math.min(1, p.holdT / (S.chargeMax * (1 - g.stats.val('anvilCharge') * 0.3)));
    p.ws.charge = k;
    if (k >= 1 && !p.ws.readyPinged) {
      p.ws.readyPinged = 1;
      const ev = g.events.push(EV.ChargeReady, p.x, p.y);
      ev.color = 0xffb347;
    }
  },
  release(g, p) {
    if (!p.ws.charge) p.ws.charge = 0;
  },
  active_(g, p) {
    const S = W.special;
    const k = p.ws.charge ?? 0;
    const len = lerp(S.rangeMin, S.rangeMax, k);
    const dmg = lerp(S.dmgMin, S.dmgMax, k);
    const h = meleeRect(g, p, 'special', p.actAngle, len, S.width, dmg, 0.55 + k * 0.45, 1 + k * 1.8, 0.1, k >= 1 ? F_LAUNCH : 0, 0, k >= 1, 1);
    h.armorMul = W.armorBreakMul * 1.2;
    if (k >= 1) h.critBonus = 1;
    // fissure FX along the line
    for (let d = 40; d <= len; d += 60) {
      const ev = g.events.push(EV.Slam, p.x + Math.cos(p.actAngle) * d, p.y + Math.sin(p.actAngle) * d);
      ev.power = 0.4 + k * 0.5;
      ev.color = 0xffb347;
    }
    if (g.stats.has('anvilAftershock')) p.ws.after = 0.25;
    p.specialCd = S.cooldown;
  },
  tick(g, p, dt) {
    if (p.ws.after > 0) {
      p.ws.after -= dt;
      if (p.ws.after <= 0) {
        const S = W.special;
        const k = p.ws.charge ?? 0;
        meleeRect(g, p, 'special', p.actAngle, lerp(S.rangeMin, S.rangeMax, k), S.width * 1.2, lerp(S.dmgMin, S.dmgMax, k) * 0.5, 0.5, 1, 0.08, 0, 0, false, 1).armorMul = W.armorBreakMul;
      }
    }
  },
};

const dashAttack: ActionSpec = {
  id: 'anvilDash',
  kind: 'dashAttack',
  windup: W.dashAttack.windup,
  active: W.dashAttack.active,
  recovery: W.dashAttack.recovery,
  moveMul: 0.2,
  lunge: W.dashAttack.lunge,
  track: true,
  chainAt: 0.35,
  active_(g, p) {
    const D = W.dashAttack;
    const h = meleeRect(g, p, 'dash', p.actAngle, D.len, D.width, D.dmg, D.power, D.knock, D.active, F_LAUNCH, 9, false, 3);
    h.armorMul = W.armorBreakMul;
  },
};

export const anvil: Weapon = {
  id: 'anvil',
  name: 'Anvilheart',
  title: 'Molten Maul',
  desc: 'Slow, crushing swings that shatter armor. Hold Special to charge a fissure — release at full charge to crit.',
  color: 0xffb347,
  assistRange: W.assistRange,
  ranged: false,
  forges: [
    { id: 'anvilCharge', name: 'Bellows', desc: 'Fissure charges 30% faster.', max: 2 },
    { id: 'anvilAftershock', name: 'Aftershock', desc: 'Fissures strike a second time.', max: 1 },
    { id: 'anvilWide', name: 'Broad Head', desc: 'Swings reach 25% further.', max: 2 },
    { id: 'anvilEarthsplit', name: 'Earthsplitter', desc: 'Your finisher sends out a damaging shockwave.', max: 1 },
    { id: 'forgeAttack', name: 'Heavier Head', desc: 'Swings deal +20% damage.', max: 3 },
  ],
  attack(g, p) {
    return comboSpecs[nextComboStep(g, p, comboSpecs.length, W.comboResetTime)];
  },
  special() {
    return special;
  },
  dashAttack() {
    return dashAttack;
  },
  specialReady(g, p) {
    return p.specialCd <= 0 ? 1 : 1 - p.specialCd / W.special.cooldown;
  },
};
