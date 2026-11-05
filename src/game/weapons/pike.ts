import { TUNING } from '../../config/tuning';
import { EV } from '../events';
import { F_LAUNCH, F_NOSTOP, meleeCircle, meleeRect, nextComboStep } from './common';
import { firePlayer, PJ } from '../projectiles';
import { emitSwing } from '../player';
import type { ActionSpec, Weapon } from './types';

const W = TUNING.weapons.pike;

/** Moonreach — a long pike. Thrusts crit with the tip, so spacing is everything. Special: hold to whirl. */
const comboSpecs: ActionSpec[] = W.combo.map((c, i) => {
  const finisher = i === W.combo.length - 1;
  const spec: ActionSpec = {
    id: 'pike' + i,
    kind: 'attack',
    step: i,
    finisher,
    windup: c.windup * (1 - Math.min(0.4, 0)),
    active: c.active,
    recovery: c.recovery,
    moveMul: 0.3,
    lunge: c.lunge,
    track: true,
    chainAt: 0.32,
    active_(g, p) {
      const reach = g.stats.val('pikeReach') * 25;
      const h = meleeRect(g, p, 'attack', p.actAngle, c.len + reach, c.width, c.dmg, c.power, c.knock, c.active, finisher ? F_LAUNCH : 0, i, finisher, 1);
      h.tip = W.tipFraction + g.stats.val('pikeTip') * 0.12;
      h.ref = W.tipCritBonus;
      if (finisher && g.stats.has('pikeWave')) {
        const pr = firePlayer(g, PJ.Wave, p.x, p.y, p.actAngle, 700, c.dmg * 0.6, 'attack', 0.5, 26, 'moonWave');
        pr.pierce = 99;
        pr.life = pr.maxLife = 0.6;
        pr.knock = 1.2;
      }
    },
  };
  return spec;
});

const special: ActionSpec = {
  id: 'pikeWhirl',
  kind: 'special',
  windup: 0.04,
  active: 0.12,
  recovery: 0.18,
  moveMul: 0.55,
  hold: 'special',
  holdMax: W.special.maxTime,
  holdMoveMul: W.special.moveMul,
  chainAt: 0.3,
  start(g, p) {
    p.ws.spinT = 0;
    p.ws.spinN = 0;
  },
  holdTick(g, p, dt) {
    const S = W.special;
    p.ws.spinT -= dt;
    if (p.ws.spinT <= 0) {
      p.ws.spinT = S.tickEvery;
      p.ws.spinN = (p.ws.spinN ?? 0) + 1;
      const h = meleeCircle(g, p, 'special', p.x, p.y, S.radius, S.dmg, S.power, 0.5, 0.05, p.ws.spinN % 3 === 0 ? 0 : F_NOSTOP);
      h.follow = false;
      emitSwing(g, p, p.ws.spinN * 1.9, Math.PI * 2, S.radius, p.ws.spinN, false, 2);
      // pull enemies into the whirl
      if (g.stats.has('pikeSpinPull')) {
        for (const e of g.enemies.live) {
          if (!e.targetable || e.def.noKnock) continue;
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < S.radius * 1.8 && d > 40) {
            e.kx += (dx / d) * 120;
            e.ky += (dy / d) * 120;
          }
        }
      }
    }
  },
  active_(g, p) {
    // closing sweep
    const h = meleeCircle(g, p, 'special', p.x, p.y, W.special.radius * 1.1, W.special.dmg * 2.2, 0.6, 1.6, 0.06, 0);
    h.follow = false;
    emitSwing(g, p, p.actAngle, Math.PI * 2, W.special.radius * 1.1, 3, true, 2);
    p.specialCd = W.special.cooldown;
  },
};

const dashAttack: ActionSpec = {
  id: 'pikeDash',
  kind: 'dashAttack',
  windup: W.dashAttack.windup,
  active: W.dashAttack.active,
  recovery: W.dashAttack.recovery,
  moveMul: 0.2,
  lunge: W.dashAttack.lunge,
  track: true,
  chainAt: 0.3,
  active_(g, p) {
    const D = W.dashAttack;
    const h = meleeRect(g, p, 'dash', p.actAngle, D.len, D.width, D.dmg, D.power, D.knock, D.active, 0, 9, false, 3);
    h.tip = W.tipFraction;
    h.ref = W.tipCritBonus;
    const ev = g.events.push(EV.Shoot, p.x, p.y);
    ev.key = 'pike';
  },
};

export const pike: Weapon = {
  id: 'pike',
  name: 'Moonreach',
  title: 'Crescent Pike',
  desc: 'Long thrusts that crit with the tip — keep your distance. Hold Special to whirl through crowds.',
  color: 0x9fe7ff,
  assistRange: W.assistRange,
  ranged: false,
  forges: [
    { id: 'pikeTip', name: 'Honed Tip', desc: 'The critical tip zone is larger.', max: 2 },
    { id: 'pikeReach', name: 'Longer Haft', desc: 'Thrusts reach 25 units further.', max: 2 },
    { id: 'pikeSpinPull', name: 'Tidal Whirl', desc: 'Your whirl drags enemies in.', max: 1 },
    { id: 'pikeWave', name: 'Moonwave', desc: 'Your finisher launches a piercing crescent wave.', max: 1 },
    { id: 'forgeSpecial', name: 'Razor Arc', desc: 'Whirl deals +30% damage.', max: 2 },
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
    return p.specialCd <= 0 ? 1 : 1 - p.specialCd / Math.max(0.01, W.special.cooldown);
  },
};
