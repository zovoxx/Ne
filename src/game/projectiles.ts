import { TUNING } from '../config/tuning';
import { Enemy, Projectile, TEAM_ENEMY, TEAM_PLAYER, type Slot } from './entities';
import { EV } from './events';
import type { Game } from './game';
import { damageEnemy, explode, hitInfo } from './combat';
import { angleDiff, clamp, lerp } from './math';

export const PJ = {
  Bullet: 1,
  Knife: 2,
  Arrow: 3,
  PowerArrow: 4,
  Lob: 5,
  Hook: 6,
  Homing: 7,
  Halo: 8,
  Bolt: 9,
  Needle: 10,
  Blade: 11,
  Saw: 12,
  Wave: 13,
  Orb: 14,
  Spark: 15,
  Seed: 16,
} as const;

export function fireEnemy(
  g: Game,
  owner: Enemy | null,
  kind: number,
  x: number,
  y: number,
  angle: number,
  speed: number,
  dmg: number,
  r = 7,
  art = 'bullet',
  color = 0xff5a5a,
): Projectile {
  const p = g.projectiles.obtain();
  p.reset();
  p.team = TEAM_ENEMY;
  p.kind = kind;
  p.art = art;
  p.x = p.px = x;
  p.y = p.py = y;
  p.vx = Math.cos(angle) * speed;
  p.vy = Math.sin(angle) * speed;
  p.speed = speed;
  p.rot = angle;
  p.r = r;
  p.dmg = dmg * (owner ? owner.dmgMul : 1);
  p.owner = owner;
  p.life = p.maxLife = 4;
  p.color = color;
  if (owner) {
    const ev = g.events.push(EV.EnemyShoot, x, y);
    ev.dx = Math.cos(angle);
    ev.dy = Math.sin(angle);
    ev.n = kind;
    ev.color = color;
  }
  return p;
}

/** Lobbed shell: travels in an arc and explodes at the target. The renderer draws a ground marker. */
export function lob(g: Game, owner: Enemy | null, x: number, y: number, tx: number, ty: number, dur: number, radius: number, dmg: number, art = 'shell', color = 0xff8a3d, height = 120) {
  const p = g.projectiles.obtain();
  p.reset();
  p.team = TEAM_ENEMY;
  p.kind = PJ.Lob;
  p.art = art;
  p.lob = true;
  p.x = p.px = p.sx = x;
  p.y = p.py = p.sy = y;
  p.tx = tx;
  p.ty = ty;
  p.ldur = dur;
  p.height = height;
  p.r = radius;
  p.dmg = dmg * (owner ? owner.dmgMul : 1);
  p.owner = owner;
  p.life = p.maxLife = dur + 0.5;
  p.color = color;
  p.reflectable = false;
  const ev = g.events.push(EV.EnemyShoot, x, y);
  ev.n = PJ.Lob;
  ev.color = color;
  return p;
}

export function firePlayer(g: Game, kind: number, x: number, y: number, angle: number, speed: number, dmg: number, slot: Slot, power: number, r = 8, art = 'knife'): Projectile {
  const p = g.projectiles.obtain();
  p.reset();
  p.team = TEAM_PLAYER;
  p.kind = kind;
  p.art = art;
  p.x = p.px = x;
  p.y = p.py = y;
  p.vx = Math.cos(angle) * speed;
  p.vy = Math.sin(angle) * speed;
  p.speed = speed;
  p.rot = angle;
  p.r = r;
  p.dmg = dmg;
  p.slot = slot;
  p.power = power;
  p.life = p.maxLife = 1.2;
  p.color = g.effects.slotColor(g, slot);
  return p;
}

function killProjectile(g: Game, p: Projectile, spark: boolean) {
  p.active = false;
  if (spark) {
    const ev = g.events.push(EV.Deflect, p.x, p.y);
    ev.dx = -p.vx / (p.speed || 1);
    ev.dy = -p.vy / (p.speed || 1);
    ev.color = p.color;
    ev.flag = 1;
  }
}

export function updateProjectiles(g: Game, dt: number) {
  const pl = g.player;
  const A = g.arena;
  const list = g.projectiles.live;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!p.active) continue;
    p.px = p.x;
    p.py = p.y;
    if (p.kind === PJ.Halo) continue; // the halo weapon drives its own projectile
    const orbiter = p.st === 7;
    p.life -= dt;
    if (p.lob) {
      p.lt += dt;
      const t = clamp(p.lt / p.ldur, 0, 1);
      p.x = lerp(p.sx, p.tx, t);
      p.y = lerp(p.sy, p.ty, t);
      p.z = Math.sin(Math.PI * t) * p.height;
      p.rot += dt * 8;
      if (t >= 1) {
        p.active = false;
        explode(g, p.tx, p.ty, p.r, p.dmg, p.team === TEAM_ENEMY ? 1 : 0, 0.5, 'other', p.owner);
        g.effects.onLobLand(g, p);
      }
      continue;
    }
    if (p.life <= 0) {
      p.active = false;
      continue;
    }
    // homing (enemy pages / player seekers)
    if (p.homing > 0) {
      let tx = pl.x;
      let ty = pl.y;
      if (p.team === TEAM_PLAYER) {
        const t = nearestEnemy(g, p.x, p.y, 420);
        if (t) {
          tx = t.x;
          ty = t.y;
        } else {
          tx = p.x + p.vx;
          ty = p.y + p.vy;
        }
      }
      const cur = Math.atan2(p.vy, p.vx);
      const want = Math.atan2(ty - p.y, tx - p.x);
      const d = angleDiff(cur, want);
      const turn = p.homing * dt;
      const na = cur + clamp(d, -turn, turn);
      p.vx = Math.cos(na) * p.speed;
      p.vy = Math.sin(na) * p.speed;
      p.rot = na;
    }
    if (p.kind === PJ.Hook && p.st === 1) {
      // retracting toward owner
      const o = p.owner;
      if (!o || !o.active) {
        p.active = false;
        continue;
      }
      const dx = o.x - p.x;
      const dy = o.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 30) {
        p.active = false;
        continue;
      }
      p.vx = (dx / d) * 900;
      p.vy = (dy / d) * 900;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.spin) p.rot += p.spin * dt;
    else if (p.homing <= 0) p.rot = Math.atan2(p.vy, p.vx);
    // walls
    let out = false;
    if (orbiter) {
      // orbiting elite blades ignore walls; only test the player
      if (!pl.dead && !pl.invulnerable && (pl.x - p.x) ** 2 + (pl.y - p.y) ** 2 < (p.r + pl.r * 0.7) ** 2) g.hurtPlayer(p.dmg, p.x, p.y, p.ref as Enemy);
      continue;
    }
    if (p.x < A.x0 || p.x > A.x1) {
      if (p.bounces > 0) {
        p.vx = -p.vx;
        p.x = clamp(p.x, A.x0 + 1, A.x1 - 1);
        p.bounces--;
      } else out = true;
    }
    if (p.y < A.y0 || p.y > A.y1) {
      if (p.bounces > 0) {
        p.vy = -p.vy;
        p.y = clamp(p.y, A.y0 + 1, A.y1 - 1);
        p.bounces--;
      } else out = true;
    }
    if (!out) {
      for (const pi of A.pillars) {
        const dx = p.x - pi.x;
        const dy = p.y - pi.y;
        if (dx * dx + dy * dy < (pi.r + p.r * 0.5) ** 2) {
          out = true;
          break;
        }
      }
    }
    if (out) {
      if (p.kind === PJ.Hook) {
        p.st = 1;
        continue;
      }
      killProjectile(g, p, true);
      continue;
    }
    if (p.team === TEAM_ENEMY) {
      if (pl.dead) continue;
      const rr = p.r + pl.r * 0.7;
      const dx = pl.x - p.x;
      const dy = pl.y - p.y;
      if (dx * dx + dy * dy < rr * rr) {
        if (p.kind === PJ.Hook) {
          if (p.st === 0 && !pl.invulnerable) {
            // grab: pull the player to the owner
            p.st = 1;
            const o = p.owner;
            if (o && o.active) {
              pl.pullT = 0.4;
              pl.pullX = o.x;
              pl.pullY = o.y;
              pl.pullSpeed = 820;
              o.st = 5;
              o.t = 0;
              const ev = g.events.push(EV.PlayerHurt, pl.x, pl.y);
              ev.amount = 0;
              ev.flag = 1;
              g.hurtPlayer(p.dmg * 0.5, p.x, p.y, o);
            }
          }
          continue;
        }
        if (pl.invulnerable) continue;
        if (g.hurtPlayer(p.dmg, p.x, p.y, p.owner)) {
          if (p.pierce <= 0) p.active = false;
          else p.pierce--;
        }
      }
    } else {
      const enemies = g.enemies.live;
      for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        if (!e.active || e.spawnT > 0 || e.untargetable) continue;
        const rr = p.r + e.r;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (dx * dx + dy * dy > rr * rr) continue;
        if (p.hits.indexOf(e.id) >= 0) continue;
        p.hits.push(e.id);
        // parrying enemies reflect projectiles
        if (e.parry && p.reflectable) {
          p.team = TEAM_ENEMY;
          p.vx = -p.vx;
          p.vy = -p.vy;
          p.owner = e;
          p.dmg = Math.round(p.dmg * 0.8);
          p.hits.length = 0;
          p.reflected = true;
          const ev = g.events.push(EV.Deflect, p.x, p.y);
          ev.flag = 2;
          break;
        }
        const info = hitInfo();
        info.slot = p.slot;
        info.power = p.power;
        info.knock = p.knock;
        const sp = p.speed || Math.hypot(p.vx, p.vy) || 1;
        info.dirX = p.vx / sp;
        info.dirY = p.vy / sp;
        info.srcX = p.x - info.dirX * 40;
        info.srcY = p.y - info.dirY * 40;
        info.forceCrit = p.crit;
        if (p.kind === PJ.PowerArrow) info.pierceShield = p.a > 0;
        damageEnemy(g, e, p.dmg, info);
        g.effects.onPlayerProjectileHit(g, p, e, info);
        if (p.power >= 0.3 || info.outCrit || info.outKilled) g.requestHitstop(p.power * 0.85, info.outCrit, info.outKilled);
        if (info.outBlocked) {
          killProjectile(g, p, true);
          break;
        }
        if (p.pierce <= 0) {
          p.active = false;
          break;
        }
        p.pierce--;
      }
    }
  }
}

export function nearestEnemy(g: Game, x: number, y: number, range: number, exclude?: Enemy | null, excludeIds?: number[]): Enemy | null {
  let best: Enemy | null = null;
  let bd = range * range;
  for (const e of g.enemies.live) {
    if (!e.targetable || e === exclude) continue;
    if (excludeIds && excludeIds.indexOf(e.id) >= 0) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** destroy enemy projectiles touched by a melee swing (soft projectiles only) */
export function cutProjectiles(g: Game, x: number, y: number, radius: number, angle: number, arc: number) {
  for (const p of g.projectiles.live) {
    if (!p.active || p.team !== TEAM_ENEMY || p.lob || p.kind === PJ.Hook || p.kind === PJ.Bolt || p.kind === PJ.Saw || p.kind === PJ.Wave) continue;
    const dx = p.x - x;
    const dy = p.y - y;
    const d = Math.hypot(dx, dy);
    if (d > radius + p.r) continue;
    if (arc < Math.PI * 1.99 && Math.abs(angleDiff(angle, Math.atan2(dy, dx))) > arc / 2 + 0.3) continue;
    killProjectile(g, p, true);
  }
}

export const PLAYER_PROJECTILE_TUNING = TUNING.weapons;
