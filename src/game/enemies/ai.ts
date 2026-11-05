import { Enemy, TG, Telegraph } from '../entities';
import type { Game } from '../game';
import { angleDiff, clamp, rotateTowards } from '../math';
import { EV } from '../events';

/** scratch result of toPlayer() — read immediately, never stored */
export const P = { dx: 0, dy: 0, d: 1, a: 0 };

export function toPlayer(e: Enemy, g: Game) {
  const p = g.player;
  P.dx = p.x - e.x;
  P.dy = p.y - e.y;
  P.d = Math.hypot(P.dx, P.dy) || 1;
  P.a = Math.atan2(P.dy, P.dx);
  return P;
}

export function setState(e: Enemy, st: number) {
  e.st = st;
  e.t = 0;
}

export function stop(e: Enemy) {
  e.vx = 0;
  e.vy = 0;
}

/** move toward a point, steering around pillars */
export function moveTo(e: Enemy, g: Game, x: number, y: number, speed: number) {
  let dx = x - e.x;
  let dy = y - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) {
    stop(e);
    return d;
  }
  dx /= d;
  dy /= d;
  if (!e.flying) {
    // pillar avoidance: push sideways if a pillar is ahead
    for (const pl of g.arena.pillars) {
      const px = pl.x - e.x;
      const py = pl.y - e.y;
      const along = px * dx + py * dy;
      if (along < 0 || along > 90 + pl.r) continue;
      const perp = -px * dy + py * dx;
      if (Math.abs(perp) < pl.r + e.r + 6) {
        const s = perp > 0 ? -1 : 1;
        const nx = dx + -dy * s * 1.3;
        const ny = dy + dx * s * 1.3;
        const nl = Math.hypot(nx, ny);
        dx = nx / nl;
        dy = ny / nl;
        break;
      }
    }
  }
  e.vx = dx * speed;
  e.vy = dy * speed;
  return d;
}

export function moveDir(e: Enemy, angle: number, speed: number) {
  e.vx = Math.cos(angle) * speed;
  e.vy = Math.sin(angle) * speed;
}

/** keep a preferred distance band from the player, strafing while inside it */
export function kite(e: Enemy, g: Game, minD: number, maxD: number, speed: number, strafe = 0.6) {
  const t = toPlayer(e, g);
  if (t.d < minD) {
    // back off (angled so they don't get pinned in corners)
    const a = t.a + Math.PI + Math.sin(g.time * 1.3 + e.id) * 0.7;
    const tx = e.x + Math.cos(a) * 100;
    const ty = e.y + Math.sin(a) * 100;
    moveTo(e, g, tx, ty, speed);
    // cornered? slide along the wall toward open space
    const A = g.arena;
    if (e.x < A.x0 + e.r + 30 || e.x > A.x1 - e.r - 30 || e.y < A.y0 + e.r + 30 || e.y > A.y1 - e.r - 30) {
      const side = t.a + (e.id % 2 ? 1.6 : -1.6);
      moveDir(e, side, speed);
    }
  } else if (t.d > maxD) moveTo(e, g, g.player.x, g.player.y, speed);
  else {
    const dir = e.id % 2 ? 1 : -1;
    const a = t.a + (Math.PI / 2) * dir;
    moveDir(e, a, speed * strafe);
  }
  return t;
}

export function faceTo(e: Enemy, angle: number, rate: number, dt: number) {
  e.facing = rotateTowards(e.facing, angle, rate * dt);
}

export function facePlayer(e: Enemy, g: Game, rate = 20, dt = 1) {
  const t = toPlayer(e, g);
  e.facing = rate >= 20 ? t.a : rotateTowards(e.facing, t.a, rate * dt);
}

export function tgLine(g: Game, e: Enemy, angle: number, len: number, width: number, dur: number, color = 0xff3b4a): Telegraph {
  const t = g.telegraph(TG.Line, e.x, e.y, dur, e);
  t.angle = angle;
  t.len = len;
  t.width = width;
  t.color = color;
  const ev = g.events.push(EV.Telegraph, e.x, e.y);
  ev.flag = 0;
  ev.amount = dur;
  return t;
}

export function tgCircle(g: Game, e: Enemy | null, x: number, y: number, r: number, dur: number, color = 0xff3b4a): Telegraph {
  const t = g.telegraph(TG.Circle, x, y, dur, e);
  t.radius = r;
  t.color = color;
  return t;
}

export function tgCone(g: Game, e: Enemy, angle: number, r: number, arc: number, dur: number, color = 0xff3b4a): Telegraph {
  const t = g.telegraph(TG.Cone, e.x, e.y, dur, e);
  t.angle = angle;
  t.radius = r;
  t.arc = arc;
  t.color = color;
  return t;
}

export function tgRing(g: Game, e: Enemy | null, x: number, y: number, r: number, inner: number, dur: number, color = 0xff3b4a): Telegraph {
  const t = g.telegraph(TG.Ring, x, y, dur, e);
  t.radius = r;
  t.inner = inner;
  t.color = color;
  return t;
}

export function killTg(e: Enemy) {
  if (e.tg) e.tg.active = false;
  e.tg = null;
}

/** true if the player is inside the arc */
export function playerInArc(e: Enemy, g: Game, range: number, arc: number, angle = e.facing) {
  const t = toPlayer(e, g);
  if (t.d > range + g.player.r) return false;
  return Math.abs(angleDiff(angle, t.a)) <= arc / 2 + 0.15;
}

export function playerNear(e: Enemy, g: Game, r: number) {
  const p = g.player;
  const rr = r + p.r;
  return (p.x - e.x) ** 2 + (p.y - e.y) ** 2 < rr * rr;
}

/** distance from player to a line segment from the enemy along angle */
export function playerOnLine(g: Game, x: number, y: number, angle: number, len: number, width: number) {
  const p = g.player;
  const dx = p.x - x;
  const dy = p.y - y;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const u = dx * c + dy * s;
  const v = Math.abs(-dx * s + dy * c);
  return u > -p.r && u < len + p.r && v < width / 2 + p.r * 0.6;
}

/** predicted player position after t seconds (lead targeting, capped) */
export function leadPlayer(g: Game, t: number) {
  const p = g.player;
  return { x: p.x + clamp(p.vx, -400, 400) * t, y: p.y + clamp(p.vy, -400, 400) * t };
}

/** distance the enemy can travel along angle before hitting a wall (for charge lines) */
export function rayToWall(g: Game, x: number, y: number, angle: number, maxLen: number, r: number) {
  const A = g.arena;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  let t = maxLen;
  if (c > 0.0001) t = Math.min(t, (A.x1 - r - x) / c);
  if (c < -0.0001) t = Math.min(t, (A.x0 + r - x) / c);
  if (s > 0.0001) t = Math.min(t, (A.y1 - r - y) / s);
  if (s < -0.0001) t = Math.min(t, (A.y0 + r - y) / s);
  for (const pl of g.arena.pillars) {
    const px = pl.x - x;
    const py = pl.y - y;
    const along = px * c + py * s;
    if (along <= 0) continue;
    const perp = Math.abs(-px * s + py * c);
    const rr = pl.r + r;
    if (perp < rr) {
      const hit = along - Math.sqrt(rr * rr - perp * perp);
      if (hit < t) t = Math.max(0, hit);
    }
  }
  return Math.max(0, t);
}

export function countDef(g: Game, id: string) {
  let n = 0;
  for (const e of g.enemies.live) if (e.active && e.def.id === id) n++;
  return n;
}
