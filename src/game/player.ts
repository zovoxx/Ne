import { TUNING } from '../config/tuning';
import type { Enemy } from './entities';
import type { Game } from './game';
import { angleDiff, clamp, DEG } from './math';
import { EV } from './events';
import type { ActionSpec, Weapon } from './weapons/types';

export type Button = 'attack' | 'special' | 'dash' | 'cast';
export const BUTTONS: Button[] = ['attack', 'special', 'dash', 'cast'];

/** What the input layer hands the simulation each frame. */
export class InputFrame {
  mx = 0;
  my = 0;
  /** mouse aim (PC) */
  aimActive = false;
  aimX = 0;
  aimY = 0;
  held: Record<Button, boolean> = { attack: false, special: false, dash: false, cast: false };
  pressed: Record<Button, boolean> = { attack: false, special: false, dash: false, cast: false };
  clearPressed() {
    this.pressed.attack = this.pressed.special = this.pressed.dash = this.pressed.cast = false;
  }
}

export const PH = { Windup: 0, Hold: 1, Active: 2, Recovery: 3 } as const;

export class Player {
  x = 0;
  y = 0;
  px = 0;
  py = 0;
  vx = 0;
  vy = 0;
  r = TUNING.player.radius;
  hp = TUNING.player.maxHp;
  maxHp = TUNING.player.maxHp;
  facing = -Math.PI / 2;
  moveX = 0;
  moveY = 0;
  moving = false;
  // action state
  act: ActionSpec | null = null;
  phase = 0;
  phaseT = 0;
  actT = 0;
  actAngle = 0;
  holdT = 0;
  comboStep = -1;
  lastAttackEndT = -99;
  lastActKind = '';
  // dash
  dashing = false;
  dashT = 0;
  dashDx = 0;
  dashDy = 0;
  dashSpeed = 0;
  dashCharges = TUNING.dash.charges;
  dashCd = 0;
  lastDashStartT = -99;
  lastDashEndT = -99;
  dashAttackUsed = false;
  iframeT = 0;
  hurtT = 0;
  hurtLock = 0;
  lastHurtT = -99;
  // cast
  castCharges = TUNING.cast.charges;
  castT = 0;
  specialCd = 0;
  buf: Record<Button, number> = { attack: -99, special: -99, dash: -99, cast: -99 };
  held: Record<Button, boolean> = { attack: false, special: false, dash: false, cast: false };
  target: Enemy | null = null;
  aimAssistX = 0;
  aimAssistY = 0;
  dead = false;
  god = false;
  deathDefiance = 0;
  weapon!: Weapon;
  /** weapon-specific state */
  ws: Record<string, number> = {};
  wref: unknown = null;
  /** latched mites slow the player */
  latchSlow = 0;
  /** slowing ground zones (ink), reset every step */
  zoneSlow = 0;
  /** being pulled by a grappler */
  pullT = 0;
  pullX = 0;
  pullY = 0;
  pullSpeed = 0;
  /** external velocity (gravity wells etc.), reset each step */
  extVx = 0;
  extVy = 0;
  view: unknown = null;
  // streak / perf counters for the bot
  damageTaken = 0;

  get maxDashCharges() {
    return TUNING.dash.charges;
  }

  reset(maxHp: number) {
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.vx = this.vy = 0;
    this.act = null;
    this.dashing = false;
    this.iframeT = this.hurtT = this.hurtLock = 0;
    this.comboStep = -1;
    this.dead = false;
    this.buf.attack = this.buf.special = this.buf.dash = this.buf.cast = -99;
    this.target = null;
    this.ws = {};
    this.wref = null;
    this.latchSlow = 0;
    this.pullT = 0;
    this.specialCd = 0;
    this.damageTaken = 0;
  }

  get invulnerable() {
    return this.god || this.iframeT > 0 || this.hurtT > 0 || this.dead;
  }
}

// ───────────────────────── auto-aim ─────────────────────────

/**
 * Smart auto-aim: prefers enemies inside a cone around the movement (or facing) direction,
 * weighting distance against angle, keeps the current target to avoid flicker, and falls back
 * to anything very close so you always hit what's next to you.
 */
export function pickTarget(g: Game, p: Player, range: number, ranged: boolean, input: InputFrame): Enemy | null {
  const A = TUNING.aim;
  let dir: number;
  let cone: number;
  if (input.aimActive) {
    dir = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    cone = A.mouseSnapDeg * DEG;
  } else {
    dir = p.moving ? Math.atan2(p.moveY, p.moveX) : p.facing;
    cone = A.coneDeg * DEG;
  }
  let best: Enemy | null = null;
  let bestScore = Infinity;
  const enemies = g.enemies.live;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.targetable) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy) - e.r;
    if (d > range) continue;
    const ang = Math.abs(angleDiff(dir, Math.atan2(dy, dx)));
    const inCone = ang <= cone;
    if (!inCone && (input.aimActive || d > A.closeRadius)) continue;
    let score = Math.max(0, d) / range + (ang / Math.PI) * A.angleWeight;
    if (!inCone) score += 0.6;
    if (e === p.target) score -= A.stickiness;
    if (ranged && (e.def.roles.includes('support') || e.def.roles.includes('back'))) score -= A.priorityBonus;
    if (e.isBoss) score -= 0.1;
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

export function aimAngle(g: Game, p: Player, input: InputFrame): number {
  if (p.target && p.target.targetable) return Math.atan2(p.target.y - p.y, p.target.x - p.x);
  if (input.aimActive) return Math.atan2(input.aimY - p.y, input.aimX - p.x);
  if (p.moving) return Math.atan2(p.moveY, p.moveX);
  return p.facing;
}

// ───────────────────────── update ─────────────────────────

export function recordInput(g: Game, p: Player, input: InputFrame) {
  // stick
  let mx = input.mx;
  let my = input.my;
  const m = Math.hypot(mx, my);
  if (m < TUNING.input.deadzone) {
    mx = my = 0;
    p.moving = false;
  } else {
    p.moving = true;
    const fs = TUNING.input.fullSpeedAt;
    const mag = clamp((m - TUNING.input.deadzone) / Math.max(0.01, fs - TUNING.input.deadzone), 0, 1);
    mx = (mx / m) * mag;
    my = (my / m) * mag;
  }
  p.moveX = mx;
  p.moveY = my;
  for (const b of ['attack', 'special', 'dash', 'cast'] as Button[]) {
    if (input.pressed[b]) p.buf[b] = g.time;
    p.held[b] = input.held[b];
  }
}

function buffered(g: Game, p: Player, b: Button) {
  return g.time - p.buf[b] <= TUNING.input.buffer;
}

function maxDash(g: Game) {
  return TUNING.dash.charges + g.stats.dashCharges;
}

function canDash(g: Game, p: Player) {
  if (p.dashCharges <= 0 || p.hurtLock > 0) return false;
  if (p.dashing) return p.dashT >= TUNING.dash.duration * 0.6;
  if (!p.act) return true;
  // dash cancels windup, hold and recovery — and the tail of active frames
  if (p.phase === PH.Active) return p.phaseT >= p.act.active * 0.6;
  return true;
}

function canStart(p: Player, kind: string) {
  if (p.dashing || p.hurtLock > 0) return false;
  if (!p.act) return true;
  if (p.phase !== PH.Recovery) return false;
  const chainAt = p.act.chainAt ?? 0.35;
  if (kind === 'attack' && p.act.kind !== 'attack' && p.act.kind !== 'dashAttack') return p.phaseT >= p.act.recovery * 0.6;
  return p.phaseT >= p.act.recovery * chainAt;
}

export function startAction(g: Game, p: Player, spec: ActionSpec, input: InputFrame) {
  if (p.act) endAction(g, p, true);
  p.act = spec;
  p.phase = PH.Windup;
  p.phaseT = 0;
  p.actT = 0;
  p.holdT = 0;
  p.actAngle = aimAngle(g, p, input);
  p.facing = p.actAngle;
  p.lastActKind = spec.kind;
  spec.start?.(g, p);
  if (spec.windup <= 0) advancePhase(g, p);
}

function endAction(g: Game, p: Player, cancelled: boolean) {
  const a = p.act;
  if (!a) return;
  if (p.phase === PH.Hold && !cancelled) a.release?.(g, p);
  a.end?.(g, p);
  if (a.kind === 'attack' || a.kind === 'dashAttack') p.lastAttackEndT = g.time;
  p.act = null;
}

function advancePhase(g: Game, p: Player) {
  const a = p.act!;
  if (p.phase === PH.Windup) {
    p.phaseT = 0;
    if (a.hold && p.held[a.hold]) {
      p.phase = PH.Hold;
      p.holdT = 0;
      return;
    }
    if (a.hold) a.release?.(g, p);
    p.phase = PH.Active;
    a.active_?.(g, p);
    if (a.active <= 0) advancePhase(g, p);
  } else if (p.phase === PH.Hold) {
    p.phaseT = 0;
    a.release?.(g, p);
    p.phase = PH.Active;
    a.active_?.(g, p);
    if (p.act === a && a.active <= 0) advancePhase(g, p);
  } else if (p.phase === PH.Active) {
    p.phaseT = 0;
    p.phase = PH.Recovery;
  } else {
    endAction(g, p, false);
  }
}

function startDash(g: Game, p: Player) {
  if (p.act) endAction(g, p, true);
  const T = TUNING.dash;
  let dx = p.moveX;
  let dy = p.moveY;
  const m = Math.hypot(dx, dy);
  if (m < 0.01) {
    dx = Math.cos(p.facing);
    dy = Math.sin(p.facing);
  } else {
    dx /= m;
    dy /= m;
  }
  p.dashing = true;
  p.dashT = 0;
  p.dashDx = dx;
  p.dashDy = dy;
  p.dashSpeed = (T.distance * (1 + g.stats.dashDistance)) / T.duration;
  p.dashCharges--;
  if (p.dashCd <= 0) p.dashCd = T.cooldown * (1 + g.stats.dashCooldown);
  p.iframeT = Math.max(p.iframeT, T.iframes);
  p.lastDashStartT = g.time;
  p.dashAttackUsed = false;
  p.facing = Math.atan2(dy, dx);
  p.latchSlow = 0;
  p.pullT = 0;
  g.onPlayerDash(dx, dy);
}

function endDash(g: Game, p: Player) {
  p.dashing = false;
  p.lastDashEndT = g.time;
  const k = TUNING.dash.exitSpeedFrac;
  p.vx = p.dashDx * p.dashSpeed * k * 0.5;
  p.vy = p.dashDy * p.dashSpeed * k * 0.5;
  g.onPlayerDashEnd();
}

export function updatePlayer(g: Game, p: Player, dt: number, input: InputFrame) {
  if (p.dead) {
    p.vx *= 0.9;
    p.vy *= 0.9;
    return;
  }
  const T = TUNING;
  const st = g.stats;
  p.px = p.x;
  p.py = p.y;
  p.iframeT -= dt;
  p.hurtT -= dt;
  p.hurtLock -= dt;
  p.specialCd -= dt;
  // dash charges
  const md = maxDash(g);
  if (p.dashCharges < md) {
    p.dashCd -= dt;
    if (p.dashCd <= 0) {
      p.dashCharges++;
      p.dashCd = p.dashCharges < md ? T.dash.cooldown * (1 + st.dashCooldown) : 0;
    }
  } else p.dashCd = 0;
  // cast charges
  const mc = T.cast.charges + st.castCharges;
  if (p.castCharges < mc) {
    p.castT -= dt;
    if (p.castT <= 0) {
      p.castCharges++;
      p.castT = p.castCharges < mc ? T.cast.recharge * (1 + st.castRecharge) : 0;
    }
  }

  // targeting
  p.target = pickTarget(g, p, p.weapon.assistRange, p.weapon.ranged, input);

  // ── actions (priority: dash > special > cast > attack) ──
  if (buffered(g, p, 'dash') && canDash(g, p)) {
    p.buf.dash = -99;
    startDash(g, p);
  }
  // dash-attack: attack pressed during or right after the dash
  if (!p.dashAttackUsed && p.buf.attack >= p.lastDashStartT && buffered(g, p, 'attack')) {
    const sinceEnd = g.time - p.lastDashEndT;
    const midDash = p.dashing && p.dashT >= 0.05;
    const afterDash = !p.dashing && sinceEnd <= T.dash.dashAttackWindow && p.lastDashEndT >= p.lastDashStartT;
    if ((midDash || afterDash) && (!p.act || canStart(p, 'attack'))) {
      const spec = p.weapon.dashAttack(g, p);
      if (spec) {
        if (p.dashing) endDash(g, p);
        p.buf.attack = -99;
        p.dashAttackUsed = true;
        startAction(g, p, spec, input);
      }
    }
  }
  if (!p.dashing) {
    if (buffered(g, p, 'special') && canStart(p, 'special') && p.specialCd <= 0) {
      const spec = p.weapon.special(g, p);
      if (spec) {
        p.buf.special = -99;
        startAction(g, p, spec, input);
      }
    }
    if (buffered(g, p, 'cast') && canStart(p, 'cast') && p.castCharges > 0) {
      p.buf.cast = -99;
      startAction(g, p, g.castAction, input);
    }
    const wantAttack = buffered(g, p, 'attack') || (p.held.attack && (!p.act || p.act.kind === 'attack'));
    if (wantAttack && canStart(p, 'attack')) {
      const spec = p.weapon.attack(g, p);
      if (spec) {
        p.buf.attack = -99;
        startAction(g, p, spec, input);
      }
    }
  }

  // ── advance action ──
  if (p.act) {
    const a = p.act;
    const speed = a.kind === 'attack' ? 1 + st.attackSpeed : a.kind === 'special' ? 1 + st.specialSpeed : 1;
    const adt = dt * speed;
    p.phaseT += adt;
    p.actT += adt;
    if ((p.phase === PH.Windup || p.phase === PH.Hold) && a.track) {
      p.actAngle = aimAngle(g, p, input);
      p.facing = p.actAngle;
    }
    if (p.phase === PH.Hold) {
      p.holdT += dt;
      a.holdTick?.(g, p, dt);
      if (p.act === a && (!p.held[a.hold!] || p.holdT >= (a.holdMax ?? 9))) advancePhase(g, p);
    } else {
      a.tick?.(g, p, adt);
      if (p.act === a) {
        const dur = p.phase === PH.Windup ? a.windup : p.phase === PH.Active ? a.active : a.recovery;
        if (p.phaseT >= dur) advancePhase(g, p);
      }
    }
  }
  if (!p.act && g.time - p.lastAttackEndT > (p.weapon.id === 'anvil' ? 0.38 : 0.32)) p.comboStep = -1;

  // ── movement ──
  const maxSpeed = T.player.maxSpeed * (1 + st.moveSpeed) * (1 - Math.min(0.6, p.latchSlow + p.zoneSlow));
  p.zoneSlow = 0;
  if (p.dashing) {
    p.dashT += dt;
    p.vx = p.dashDx * p.dashSpeed;
    p.vy = p.dashDy * p.dashSpeed;
    if (p.dashT >= T.dash.duration) endDash(g, p);
  } else {
    let mul = 1;
    if (p.act) mul = p.phase === PH.Hold ? (p.act.holdMoveMul ?? p.act.moveMul) : p.act.moveMul;
    const tvx = p.moveX * maxSpeed * mul;
    const tvy = p.moveY * maxSpeed * mul;
    const accel = p.moving ? T.player.accel : T.player.decel;
    const ax = tvx - p.vx;
    const ay = tvy - p.vy;
    const al = Math.hypot(ax, ay);
    const step = accel * dt;
    if (al <= step) {
      p.vx = tvx;
      p.vy = tvy;
    } else {
      p.vx += (ax / al) * step;
      p.vy += (ay / al) * step;
    }
    // lunge during active frames
    if (p.act && p.phase === PH.Active && p.act.lunge) {
      let lunge = p.act.lunge;
      // don't lunge through the target you're hitting
      if (p.target) {
        const d = Math.hypot(p.target.x - p.x, p.target.y - p.y) - p.target.r - p.r;
        if (d < 18) lunge *= 0.15;
      }
      p.vx = Math.cos(p.actAngle) * lunge + p.moveX * maxSpeed * mul;
      p.vy = Math.sin(p.actAngle) * lunge + p.moveY * maxSpeed * mul;
    }
    if (!p.act && p.moving) p.facing = Math.atan2(p.moveY, p.moveX);
  }
  // grapple pull
  if (p.pullT > 0) {
    p.pullT -= dt;
    const dx = p.pullX - p.x;
    const dy = p.pullY - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 30) {
      p.vx = (dx / d) * p.pullSpeed;
      p.vy = (dy / d) * p.pullSpeed;
    } else p.pullT = 0;
  }
  p.x += (p.vx + p.extVx) * dt;
  p.y += (p.vy + p.extVy) * dt;
  p.extVx = p.extVy = 0;
  g.collideArena(p, p.r, false);
}

export function emitSwing(g: Game, p: Player, angle: number, arc: number, range: number, step: number, finisher: boolean, style: number) {
  const e = g.events.push(EV.Swing, p.x, p.y);
  e.dx = Math.cos(angle);
  e.dy = Math.sin(angle);
  e.amount = range;
  e.power = arc;
  e.n = step;
  e.flag = style;
  e.crit = finisher;
  e.key = p.weapon.id;
}
