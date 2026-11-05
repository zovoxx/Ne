import type { Enemy } from '../entities';
import { HZ, TEAM_ENEMY } from '../entities';
import type { Game } from '../game';
import type { EnemyDef } from './types';
import { addHazard } from '../hazards';
import { fireEnemy, PJ } from '../projectiles';
import { EV } from '../events';
import { TAU } from '../math';
import { tgCircle } from './ai';

/**
 * Pattern brain for bosses and mini-bosses: a list of attacks with weights, cooldowns, phase
 * gates and range gates. Between attacks the boss repositions briefly; at HP thresholds it
 * roars (short invulnerable transition, clears bullets) and unlocks new attacks.
 */
export interface BossAttack {
  id: string;
  weight: number;
  cd: number;
  minPhase?: number;
  maxPhase?: number;
  /** only if the player is within [min, max] distance */
  range?: [number, number];
  start(e: Enemy, g: Game): void;
  /** t = seconds since start (scaled by boss speed). Return true when finished. */
  tick(e: Enemy, g: Game, dt: number, t: number): boolean;
}

export interface BossSpec {
  attacks: BossAttack[];
  /** HP fractions where a new phase begins (e.g. [0.5] or [0.66, 0.33]) */
  phases: number[];
  idle: number;
  move(e: Enemy, g: Game, dt: number): void;
  onPhase?(e: Enemy, g: Game, phase: number): void;
}

export function bossUpdate(e: Enemy, g: Game, dt: number, spec: BossSpec) {
  // phase transitions
  const frac = e.hp / e.maxHp;
  const target = spec.phases.filter((p) => frac <= p).length;
  if (target > e.phase && e.st !== 2) {
    e.phase = target;
    g.clearTelegraphs(e);
    for (const pr of g.projectiles.live) if (pr.team === TEAM_ENEMY && pr.owner === e) pr.active = false;
    e.st = 2;
    e.t = 0;
    e.invuln = true;
    const ev = g.events.push(EV.BossPhase, e.x, e.y);
    ev.n = e.phase;
    ev.ref = e;
    spec.onPhase?.(e, g, e.phase);
  }
  for (let i = 0; i < spec.attacks.length; i++) {
    const k = 'cd' + i;
    if (e.data[k] > 0) e.data[k] -= dt;
  }
  switch (e.st) {
    case 0: {
      spec.move(e, g, dt);
      if (e.t < spec.idle * (e.phase >= 2 ? 0.6 : e.phase >= 1 ? 0.8 : 1)) break;
      const d = Math.hypot(g.player.x - e.x, g.player.y - e.y);
      const avail = spec.attacks
        .map((a, i) => ({ a, i }))
        .filter(({ a, i }) => (e.data['cd' + i] ?? 0) <= 0 && e.phase >= (a.minPhase ?? 0) && e.phase <= (a.maxPhase ?? 9) && (!a.range || (d >= a.range[0] && d <= a.range[1])) && e.data.last !== i);
      const pick = g.rng.weighted(avail.length ? avail : spec.attacks.map((a, i) => ({ a, i })), (x) => x.a.weight);
      if (!pick) break;
      e.n = pick.i;
      e.data.last = pick.i;
      e.data['cd' + pick.i] = pick.a.cd;
      e.st = 1;
      e.t = 0;
      e.vx = e.vy = 0;
      pick.a.start(e, g);
      break;
    }
    case 1: {
      const a = spec.attacks[e.n];
      if (!a || a.tick(e, g, dt, e.t)) {
        e.st = 0;
        e.t = 0;
        g.clearTelegraphs(e);
        e.superArmor = true;
      }
      break;
    }
    case 2: // roar / phase transition
      e.vx = e.vy = 0;
      if (e.t > 1.1) {
        e.invuln = false;
        e.st = 0;
        e.t = spec.idle * 0.5;
      }
      break;
  }
}

/** shared setup for bosses and mini-bosses */
export function bossInit(e: Enemy, g: Game, mini: boolean) {
  e.isBoss = !mini;
  e.isMini = mini;
  e.superArmor = true;
  e.data.marks = 1;
  if (!mini) {
    e.spawnT = 1.1;
    const ev = g.events.push(EV.BossPhase, e.x, e.y);
    ev.n = 0;
    ev.ref = e;
  }
}

/* ─────────────── attack helpers ─────────────── */

export function blastAt(g: Game, e: Enemy | null, x: number, y: number, r: number, delay: number, dmg: number, color = 0xff3b4a) {
  const A = g.arena;
  x = Math.max(A.x0 + 10, Math.min(A.x1 - 10, x));
  y = Math.max(A.y0 + 10, Math.min(A.y1 - 10, y));
  const t = tgCircle(g, null, x, y, r, delay, color);
  t.linger = 0.01;
  const h = addHazard(g, HZ.Blast, TEAM_ENEMY, x, y, r, delay + 0.5, dmg, color, e);
  h.a = delay;
  return h;
}

export function ring(g: Game, e: Enemy, n: number, speed: number, dmg: number, offset = 0, gap = -1, gapSize = 0, art = 'bullet', color = 0xff5a8a, kind: number = PJ.Orb) {
  for (let i = 0; i < n; i++) {
    const a = offset + (i / n) * TAU;
    if (gap >= 0) {
      let d = Math.abs(((a - gap) % TAU + TAU) % TAU);
      if (d > Math.PI) d = TAU - d;
      if (d < gapSize) continue;
    }
    fireEnemy(g, e, kind, e.x, e.y, a, speed, dmg, 9, art, color);
  }
}

export function fan(g: Game, e: Enemy, angle: number, n: number, spread: number, speed: number, dmg: number, art = 'bullet', color = 0xff5a8a, kind: number = PJ.Bullet, r = 8) {
  for (let i = 0; i < n; i++) {
    const a = angle + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
    fireEnemy(g, e, kind, e.x + Math.cos(a) * e.r * 0.6, e.y + Math.sin(a) * e.r * 0.6, a, speed, dmg, r, art, color);
  }
}

export function summon(g: Game, e: Enemy, def: EnemyDef, n: number, dist = 120) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + g.rng.range(0, 1);
    const pt = g.freePointNear(e.x + Math.cos(a) * dist, e.y + Math.sin(a) * dist, 0, 60, def.radius);
    g.spawnEnemy(def, pt.x, pt.y, { summoned: true, parent: e });
  }
}
