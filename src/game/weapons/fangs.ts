import { TUNING } from '../../config/tuning';
import type { Game } from '../game';
import { DEG } from '../math';
import type { Player } from '../player';
import { firePlayer, PJ } from '../projectiles';
import { EV } from '../events';
import { F_BACKSTAB, F_LAUNCH, meleeArc, meleeRect, nextComboStep } from './common';
import type { ActionSpec, Weapon } from './types';

const W = TUNING.weapons.fangs;

/** Kestrel Fangs — twin blades. Fast 4-hit combo ending in a spin, knife fan special, backstab crits. */
const comboSpecs: ActionSpec[] = W.combo.map((c, i) => {
  const finisher = i === W.combo.length - 1;
  const spec: ActionSpec = {
    id: 'fangs' + i,
    kind: 'attack',
    step: i,
    finisher,
    windup: c.windup,
    active: c.active,
    recovery: c.recovery,
    moveMul: finisher ? 0.5 : TUNING.player.attackMoveMul,
    lunge: c.lunge,
    track: true,
    chainAt: 0.3,
    active_(g, p) {
      const extra = g.stats.val('fangsReach');
      meleeArc(g, p, 'attack', p.actAngle, c.range + extra, c.arc, c.dmg, c.power, c.knock, c.active, F_BACKSTAB | (finisher ? F_LAUNCH : 0), i, finisher, finisher ? 2 : i % 2);
      if (finisher && g.stats.has('fangsFinisherKnives')) fan(g, p, 6, 360 / 6, 0.6);
    },
  };
  return spec;
});

function fan(g: Game, p: Player, n: number, spreadDeg: number, dmgMul: number) {
  const S = W.special;
  const base = p.actAngle;
  const pierce = S.pierce + g.stats.val('fangsPierce');
  for (let k = 0; k < n; k++) {
    const a = base + (k - (n - 1) / 2) * spreadDeg * DEG;
    const pr = firePlayer(g, PJ.Knife, p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14, a, S.speed, S.dmg * dmgMul * (1 + g.stats.val('forgeSpecial')), 'special', S.power, 9, 'knife');
    pr.pierce = pierce;
    pr.life = pr.maxLife = S.range / S.speed;
    pr.knock = 0.35;
    if (g.stats.has('fangsBleedKnives')) pr.a = 1;
  }
  const ev = g.events.push(EV.Shoot, p.x, p.y);
  ev.dx = Math.cos(base);
  ev.dy = Math.sin(base);
  ev.key = 'fangs';
  ev.n = n;
}

const special: ActionSpec = {
  id: 'fangsSpecial',
  kind: 'special',
  windup: 0.035,
  active: 0.02,
  recovery: 0.12,
  moveMul: 0.65,
  track: true,
  chainAt: 0.25,
  active_(g, p) {
    const n = W.special.knives + g.stats.val('fangsKnives');
    fan(g, p, n, W.special.spreadDeg, 1);
    p.specialCd = W.special.cooldown * (1 - g.stats.val('fangsSpecialCd'));
  },
};

const dashAttack: ActionSpec = {
  id: 'fangsDash',
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
    const h = meleeRect(g, p, 'dash', p.actAngle, D.len, D.width, D.dmg, D.power, D.knock, D.active, F_BACKSTAB, 9, false, 3);
    h.critBonus = 0.25 + g.stats.val('fangsDashCrit');
    h.follow = true;
  },
};

export const fangs: Weapon = {
  id: 'fangs',
  name: 'Kestrel Fangs',
  title: 'Twin Blades',
  desc: 'Fast four-hit combo that ends in a spin. Special throws a fan of knives. Strikes from behind crit.',
  color: 0xff6b8a,
  assistRange: W.assistRange,
  ranged: false,
  forges: [
    { id: 'fangsKnives', name: 'Fan of Fangs', desc: 'Special throws +2 knives.', max: 2 },
    { id: 'fangsPierce', name: 'Needle Edge', desc: 'Knives pierce +2 more enemies.', max: 2 },
    { id: 'fangsFinisherKnives', name: 'Whirling Steel', desc: 'Your spin finisher also throws a ring of 6 knives.', max: 1 },
    { id: 'fangsDashCrit', name: 'Ambush', desc: 'Dash-strike has +35% crit chance.', max: 2 },
    { id: 'fangsReach', name: 'Long Talons', desc: 'Slashes reach 18 units further.', max: 2 },
    { id: 'fangsSpecialCd', name: 'Quickdraw', desc: 'Knife fan recovers 30% faster.', max: 2 },
  ],
  attack(g, p) {
    const step = nextComboStep(g, p, comboSpecs.length, W.comboResetTime);
    return comboSpecs[step];
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
