import { TUNING } from '../../config/tuning';
import { EV } from '../events';
import { clamp, DEG, lerp } from '../math';
import { firePlayer, PJ } from '../projectiles';
import { addHazard } from '../hazards';
import { HZ, TEAM_PLAYER } from '../entities';
import type { Game } from '../game';
import type { Player } from '../player';
import type { ActionSpec, Weapon } from './types';

const W = TUNING.weapons.bow;
export const HZ_RAIN = 21;

function arrow(g: Game, p: Player, angle: number, dmg: number, speed: number, power: number, kind: number, art: string) {
  const pr = firePlayer(g, kind, p.x + Math.cos(angle) * 18, p.y + Math.sin(angle) * 18 - 4, angle, speed, dmg, 'attack', power, kind === PJ.PowerArrow ? 12 : 8, art);
  pr.life = pr.maxLife = W.shot.range / speed + 0.1;
  pr.knock = kind === PJ.PowerArrow ? 1.4 : 0.4;
  return pr;
}

/** Vesper Bow — tap for quick shots, hold to draw a piercing power shot (release on the flash = crit). */
const draw: ActionSpec = {
  id: 'bowDraw',
  kind: 'attack',
  windup: 0.02,
  active: 0.02,
  recovery: W.shot.cooldown - 0.04,
  moveMul: 0.85,
  hold: 'attack',
  holdMax: 30,
  holdMoveMul: W.charge.moveMul,
  track: true,
  chainAt: 0.2,
  start(g, p) {
    p.ws.k = 0;
    p.ws.ping = 0;
  },
  holdTick(g, p) {
    const ct = W.charge.time * (1 - g.stats.val('bowQuickDraw') * 0.3);
    p.ws.k = clamp(p.holdT / ct, 0, 1);
    p.ws.perfect = p.holdT >= ct && p.holdT <= ct + W.charge.perfectWindow ? 1 : 0;
    if (p.holdT >= ct && !p.ws.ping) {
      p.ws.ping = 1;
      const ev = g.events.push(EV.ChargeReady, p.x, p.y);
      ev.color = 0xe2d4ff;
    }
  },
  active_(g, p) {
    const S = g.stats;
    const held = p.holdT;
    const a = p.actAngle;
    if (held < 0.14) {
      // quick shot (every Nth is a volley)
      p.ws.shots = (p.ws.shots ?? 0) + 1;
      const volley = p.ws.shots % W.volleyEvery === 0;
      const n = volley ? W.volley.arrows + S.val('bowVolley') * 2 : 1;
      for (let i = 0; i < n; i++) {
        const pr = arrow(g, p, a + (i - (n - 1) / 2) * W.volley.spreadDeg * DEG, W.shot.dmg * (1 + S.val('forgeAttack') * 0.2), W.shot.speed, W.shot.power, PJ.Arrow, 'arrow');
        pr.pierce = S.val('bowPierce');
      }
      const ev = g.events.push(EV.Shoot, p.x, p.y);
      ev.dx = Math.cos(a);
      ev.dy = Math.sin(a);
      ev.key = 'bow';
      return;
    }
    const k = p.ws.k ?? 0;
    const perfect = !!p.ws.perfect;
    const C = W.charge;
    const dmg = perfect ? C.perfectDmg : lerp(W.shot.dmg, C.dmg, k);
    const pr = arrow(g, p, a, dmg * (1 + S.val('forgeAttack') * 0.2), lerp(W.shot.speed, C.speed, k), lerp(0.3, C.power, k), PJ.PowerArrow, 'arrow');
    pr.scale = 1 + k * 0.6;
    pr.pierce = k >= 1 ? C.pierce : 1;
    pr.crit = perfect;
    pr.a = k >= 1 ? 1 : 0; // full charge pierces shields
    if (S.val('bowSplit') > 0 && k >= 1) pr.b = 1;
    const ev = g.events.push(EV.Shoot, p.x, p.y);
    ev.dx = Math.cos(a);
    ev.dy = Math.sin(a);
    ev.key = 'bow';
    ev.crit = perfect;
    if (perfect) {
      const t = g.events.push(EV.Text, p.x, p.y - 34);
      t.key = 'PERFECT';
    }
  },
};

const special: ActionSpec = {
  id: 'bowRain',
  kind: 'special',
  windup: 0.06,
  active: 0.02,
  recovery: 0.16,
  moveMul: 0.6,
  track: true,
  chainAt: 0.25,
  active_(g, p) {
    const S = W.special;
    const st = g.stats;
    const t = p.target && p.target.targetable ? { x: p.target.x, y: p.target.y } : { x: p.x + Math.cos(p.actAngle) * 260, y: p.y + Math.sin(p.actAngle) * 260 };
    const A = g.arena;
    const h = addHazard(g, HZ_RAIN, TEAM_PLAYER, clamp(t.x, A.x0 + 20, A.x1 - 20), clamp(t.y, A.y0 + 20, A.y1 - 20), S.radius * (1 + st.val('bowRain') * 0.2), S.delay + (S.hits + st.val('bowRain') * 3) * S.interval + 0.2, S.dmg * (1 + st.val('forgeSpecial') * 0.3), 0xe2d4ff, null);
    h.armT = S.delay;
    h.tick = S.interval;
    h.a = S.hits + st.val('bowRain') * 3;
    const ev = g.events.push(EV.CastThrow, p.x, p.y);
    ev.dx = h.x;
    ev.dy = h.y;
    ev.amount = h.r;
    ev.color = 0xe2d4ff;
    p.specialCd = S.cooldown;
  },
};

const dashAttack: ActionSpec = {
  id: 'bowDash',
  kind: 'dashAttack',
  windup: 0.02,
  active: 0.02,
  recovery: 0.14,
  moveMul: 0.5,
  track: true,
  chainAt: 0.3,
  active_(g, p) {
    const D = W.dashAttack;
    for (let i = 0; i < D.arrows; i++) {
      const a = p.actAngle + (i - (D.arrows - 1) / 2) * ((D.spreadDeg / (D.arrows - 1)) * DEG);
      const pr = arrow(g, p, a, D.dmg, D.speed, D.power, PJ.Arrow, 'arrow');
      pr.slot = 'dash';
      pr.color = g.effects.slotColor(g, 'dash');
    }
    const ev = g.events.push(EV.Shoot, p.x, p.y);
    ev.key = 'bow';
  },
};

export const bow: Weapon = {
  id: 'bow',
  name: 'Vesper Bow',
  title: 'Starlight Bow',
  desc: 'Tap for quick shots — every fourth is a volley. Hold to draw a piercing shot; release as it flashes for a perfect crit. Special rains stars.',
  color: 0xe2d4ff,
  assistRange: W.assistRange,
  ranged: true,
  forges: [
    { id: 'bowQuickDraw', name: 'Quick Draw', desc: 'Power shots charge 30% faster.', max: 2 },
    { id: 'bowVolley', name: 'Wider Volley', desc: 'Volleys fire 2 more arrows.', max: 2 },
    { id: 'bowRain', name: 'Meteor Shower', desc: 'Starfall strikes 3 more times over a wider area.', max: 2 },
    { id: 'bowPierce', name: 'Piercing Tips', desc: 'Quick shots pierce 1 enemy.', max: 2 },
    { id: 'bowSplit', name: 'Splitting Star', desc: 'Full power shots split into 3 arrows on impact.', max: 1 },
  ],
  attack() {
    return draw;
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

export const _hz = HZ;
