import { HB, type Slot } from '../entities';
import type { Game } from '../game';
import { DEG } from '../math';
import { emitSwing, type Player } from '../player';
import { spawnHitbox } from '../combat';
import { cutProjectiles } from '../projectiles';

export const F_BACKSTAB = 1;
export const F_LAUNCH = 2;
export const F_NOSTOP = 4;
export const F_DIRKNOCK = 8;

/** spawn a melee arc in front of the player and emit the swing FX event */
export function meleeArc(
  g: Game,
  p: Player,
  slot: Slot,
  angle: number,
  range: number,
  arcDeg: number,
  dmg: number,
  power: number,
  knock: number,
  life: number,
  flags: number,
  step: number,
  finisher: boolean,
  style = 0,
) {
  const h = spawnHitbox(g, slot, HB.Arc, angle, Math.max(0.02, life));
  h.range = range;
  h.arc = arcDeg * DEG;
  h.dmg = dmg * forgeMul(g, slot);
  h.power = power;
  h.knock = knock;
  h.flags = flags;
  h.finisher = finisher;
  h.combo = step;
  cutProjectiles(g, p.x, p.y, range + 10, angle, arcDeg * DEG);
  emitSwing(g, p, angle, arcDeg * DEG, range, step, finisher, style);
  return h;
}

/** spawn a rectangular thrust along the angle */
export function meleeRect(
  g: Game,
  p: Player,
  slot: Slot,
  angle: number,
  len: number,
  width: number,
  dmg: number,
  power: number,
  knock: number,
  life: number,
  flags: number,
  step: number,
  finisher: boolean,
  style = 1,
) {
  const h = spawnHitbox(g, slot, HB.Rect, angle, Math.max(0.02, life));
  h.len = len;
  h.width = width;
  h.dmg = dmg * forgeMul(g, slot);
  h.power = power;
  h.knock = knock;
  h.flags = flags;
  h.finisher = finisher;
  h.combo = step;
  h.offset = -10;
  cutProjectiles(g, p.x + Math.cos(angle) * len * 0.5, p.y + Math.sin(angle) * len * 0.5, len * 0.55, angle, Math.PI * 2);
  emitSwing(g, p, angle, width, len, step, finisher, style);
  return h;
}

export function meleeCircle(g: Game, p: Player, slot: Slot, x: number, y: number, radius: number, dmg: number, power: number, knock: number, life: number, flags: number) {
  const h = spawnHitbox(g, slot, HB.Circle, 0, Math.max(0.02, life));
  h.follow = false;
  h.x = x;
  h.y = y;
  h.radius = radius;
  h.dmg = dmg * forgeMul(g, slot);
  h.power = power;
  h.knock = knock;
  h.flags = flags | F_NOSTOP * 0;
  cutProjectiles(g, x, y, radius, 0, Math.PI * 2);
  return h;
}

/** weapon forge damage bonus (set by forge upgrades) */
export function forgeMul(g: Game, slot: Slot) {
  const s = g.stats;
  if (slot === 'attack') return 1 + s.val('forgeAttack');
  if (slot === 'special') return 1 + s.val('forgeSpecial');
  return 1;
}

/** advances the combo step and returns it */
export function nextComboStep(g: Game, p: Player, len: number, resetTime: number) {
  const chaining = p.lastActKind === 'attack' && (p.act?.kind === 'attack' || g.time - p.lastAttackEndT < resetTime);
  p.comboStep = chaining ? (p.comboStep + 1) % len : 0;
  return p.comboStep;
}
