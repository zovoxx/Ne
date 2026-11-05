import { TUNING } from '../config/tuning';
import { Enemy, Hazard, HZ, TEAM_ENEMY, TEAM_PLAYER } from './entities';
import { EV } from './events';
import type { Game } from './game';
import { damageEnemy, explode, hitInfo } from './combat';
import { distToSegment } from './math';

export function addHazard(g: Game, kind: number, team: number, x: number, y: number, r: number, life: number, dmg: number, color: number, owner: Enemy | null = null): Hazard {
  const h = g.hazards.obtain();
  h.reset();
  h.kind = kind;
  h.team = team;
  h.x = h.x2 = x;
  h.y = h.y2 = y;
  h.r = r;
  h.life = h.maxLife = life;
  h.dmg = dmg * (owner && team === TEAM_ENEMY ? owner.dmgMul : 1);
  h.color = color;
  h.owner = owner;
  h.tick = 0.5;
  return h;
}

/** expanding shockwave ring that hits the player once as its edge passes */
export function addPulse(g: Game, x: number, y: number, maxR: number, dur: number, dmg: number, color: number, owner: Enemy | null, width = 26) {
  const h = addHazard(g, HZ.Pulse, TEAM_ENEMY, x, y, maxR, dur, dmg, color, owner);
  h.w = width;
  return h;
}

function playerInCircle(g: Game, h: Hazard, shrink = 0.6) {
  const p = g.player;
  const rr = h.r + p.r * shrink;
  return (p.x - h.x) ** 2 + (p.y - h.y) ** 2 < rr * rr;
}

function enemyTick(g: Game, h: Hazard, dt: number, fn: (e: Enemy) => void) {
  h.tickT -= dt;
  if (h.tickT > 0) return;
  h.tickT = h.tick;
  for (const e of g.enemies.live) {
    if (!e.targetable) continue;
    const rr = h.r + e.r;
    if ((e.x - h.x) ** 2 + (e.y - h.y) ** 2 < rr * rr) fn(e);
  }
}

function dotInfo(color: number) {
  const info = hitInfo();
  info.isDot = true;
  info.slot = 'other';
  info.noStatus = true;
  info.color = color;
  return info;
}

export function updateHazards(g: Game, dt: number) {
  const p = g.player;
  const list = g.hazards.live;
  for (let i = 0; i < list.length; i++) {
    const h = list[i];
    if (!h.active) continue;
    h.life -= dt;
    if (h.armT > 0) {
      h.armT -= dt;
      if (h.armT <= 0) onArm(g, h);
      if (h.life <= 0) h.active = false;
      continue;
    }
    switch (h.kind) {
      case HZ.Fire:
      case HZ.Slag:
        if (h.team === TEAM_ENEMY) {
          if (playerInCircle(g, h, 0.4)) g.hurtPlayer(h.dmg, h.x, h.y, h.owner);
        } else {
          enemyTick(g, h, dt, (e) => {
            e.burn = Math.min(g.stats.burnMax, e.burn + 1);
          });
        }
        break;
      case HZ.Ink:
        if (playerInCircle(g, h, 0.3)) p.zoneSlow = Math.max(p.zoneSlow, 0.4);
        break;
      case HZ.Fence:
      case HZ.Tether: {
        const a = h.linkA;
        const b = h.linkB;
        if (!a || !b || !a.active || !b.active) {
          h.active = false;
          break;
        }
        h.x = a.x;
        h.y = a.y;
        h.x2 = b.x;
        h.y2 = b.y;
        if (h.kind === HZ.Tether && (a.spawnT > 0 || b.spawnT > 0)) break;
        if (distToSegment(p.x, p.y, h.x, h.y, h.x2, h.y2) < h.w + p.r * 0.5) g.hurtPlayer(h.dmg, (h.x + h.x2) / 2, (h.y + h.y2) / 2, a);
        break;
      }
      case HZ.Beam: {
        // owner-attached rotating/static laser. angle may sweep (h.a = angular speed)
        const o = h.owner;
        if (o && !o.active) {
          h.active = false;
          break;
        }
        if (o) {
          h.x = o.x;
          h.y = o.y;
        }
        h.angle += h.a * dt;
        h.x2 = h.x + Math.cos(h.angle) * h.r;
        h.y2 = h.y + Math.sin(h.angle) * h.r;
        if (distToSegment(p.x, p.y, h.x, h.y, h.x2, h.y2) < h.w * 0.5 + p.r * 0.5) g.hurtPlayer(h.dmg, h.x, h.y, o);
        break;
      }
      case HZ.Well: {
        const dx = h.x - p.x;
        const dy = h.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < h.r * 3.2 && !p.dashing) {
          const pull = (h.b || 190) * (1 - d / (h.r * 3.2) + 0.35);
          p.extVx += (dx / d) * pull;
          p.extVy += (dy / d) * pull;
        }
        if (d < h.r * 0.45) g.hurtPlayer(h.dmg, h.x, h.y, h.owner);
        break;
      }
      case HZ.Mine: {
        if (h.st === 0) {
          const rr = 58;
          if ((p.x - h.x) ** 2 + (p.y - h.y) ** 2 < rr * rr || h.life < 0.45) {
            h.st = 1;
            h.a = 0.45;
            const ev = g.events.push(EV.Telegraph, h.x, h.y);
            ev.flag = 1;
          }
        } else {
          h.a -= dt;
          if (h.a <= 0) {
            h.active = false;
            explode(g, h.x, h.y, h.r, h.dmg, 1, 0.5, 'other', h.owner);
          }
        }
        break;
      }
      case HZ.Pulse: {
        // ring radius grows from 0 → r over its life
        const k = 1 - h.life / h.maxLife;
        const cur = h.r * k;
        const d = Math.hypot(p.x - h.x, p.y - h.y);
        if (h.st === 0 && Math.abs(d - cur) < h.w * 0.5 + p.r * 0.4) {
          if (g.hurtPlayer(h.dmg, h.x, h.y, h.owner)) h.st = 1;
        }
        break;
      }
      case HZ.Void: {
        // arena-shrinking void: everything outside radius r from (x,y) hurts
        const d = Math.hypot(p.x - h.x, p.y - h.y);
        if (d > h.r) {
          g.hurtPlayer(h.dmg, h.x, h.y, h.owner);
          const k = 260 / (d || 1);
          p.extVx += (h.x - p.x) * k * 0.01 * 60;
          p.extVy += (h.y - p.y) * k * 0.01 * 60;
        }
        break;
      }
      // ── player-team zones (cast / dash boons) ──
      case HZ.Frost:
        enemyTick(g, h, dt, (e) => g.effects.applyElement(g, e, 'rime', 1, 'cast'));
        break;
      case HZ.Storm:
        h.tickT -= dt;
        if (h.tickT <= 0) {
          h.tickT = h.tick;
          let best: Enemy | null = null;
          let bd = Infinity;
          for (const e of g.enemies.live) {
            if (!e.targetable) continue;
            const d = (e.x - h.x) ** 2 + (e.y - h.y) ** 2;
            if (d < (h.r + e.r) ** 2 && d < bd) {
              bd = d;
              best = e;
            }
          }
          if (best) {
            const info = hitInfo();
            info.slot = 'cast';
            info.power = 0.35;
            info.knock = 0.3;
            info.srcX = best.x;
            info.srcY = best.y - 10;
            info.dirY = 1;
            info.dirX = 0;
            info.noStatus = true;
            const ev = g.events.push(EV.Lightning, best.x, best.y - 260);
            ev.dx = best.x;
            ev.dy = best.y;
            damageEnemy(g, best, h.dmg, info);
          }
        }
        break;
      case HZ.Wind:
      case HZ.Vortex: {
        const pullIn = h.kind === HZ.Vortex;
        for (const e of g.enemies.live) {
          if (!e.targetable || e.def.noKnock) continue;
          const dx = h.x - e.x;
          const dy = h.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < h.r * 1.6) {
            const f = (pullIn ? 520 : -380) * dt;
            e.kx += (dx / d) * f * 6;
            e.ky += (dy / d) * f * 6;
          }
        }
        enemyTick(g, h, dt, (e) => {
          const info = dotInfo(h.color);
          info.slot = 'cast';
          damageEnemy(g, e, h.dmg, info);
        });
        if (h.b) {
          // moving tornado
          h.x += Math.cos(h.angle) * h.b * dt;
          h.y += Math.sin(h.angle) * h.b * dt;
        }
        break;
      }
      case HZ.Bramble:
        enemyTick(g, h, dt, (e) => {
          e.bleed = Math.min(g.stats.bleedMax, e.bleed + 1);
          e.slowT = 0.6;
          e.slow = 0.35;
          const info = dotInfo(0x9cff5a);
          damageEnemy(g, e, h.dmg, info);
        });
        break;
      case HZ.Radiance:
        enemyTick(g, h, dt, (e) => {
          e.mark = Math.max(e.mark, 2.5);
        });
        break;
      case HZ.Hex:
        enemyTick(g, h, dt, (e) => g.effects.applyElement(g, e, 'umbra', 1, 'cast'));
        break;
      case HZ.Cloud:
        if (h.team === TEAM_PLAYER) {
          enemyTick(g, h, dt, (e) => {
            const info = dotInfo(h.color);
            damageEnemy(g, e, h.dmg, info);
          });
        } else if (playerInCircle(g, h, 0.3)) g.hurtPlayer(h.dmg, h.x, h.y, h.owner);
        break;
      default:
        break;
    }
    if (h.life <= 0) h.active = false;
  }
}

function onArm(g: Game, h: Hazard) {
  if (h.kind === HZ.Sigil) {
    detonateSigil(g, h);
    return;
  }
  if (h.kind === HZ.Fence || h.kind === HZ.Beam) {
    const ev = g.events.push(EV.Beam, h.x, h.y);
    ev.dx = h.x2;
    ev.dy = h.y2;
    ev.color = h.color;
  }
}

export function detonateSigil(g: Game, h: Hazard) {
  const root = TUNING.cast.rootTime + g.stats.castRoot;
  const ev = g.events.push(EV.CastBoom, h.x, h.y);
  ev.amount = h.r;
  ev.color = h.color;
  let hits = 0;
  for (const e of g.enemies.live) {
    if (!e.targetable) continue;
    const dx = e.x - h.x;
    const dy = e.y - h.y;
    const d = Math.hypot(dx, dy);
    if (d > h.r + e.r) continue;
    hits++;
    const info = hitInfo();
    info.slot = 'cast';
    info.power = 0.55;
    info.knock = 0.2;
    info.dirX = d > 0 ? dx / d : 0;
    info.dirY = d > 0 ? dy / d : 1;
    info.srcX = h.x;
    info.srcY = h.y;
    info.pierceShield = true;
    damageEnemy(g, e, h.dmg, info);
    if (e.active && !e.isBoss) e.root = Math.max(e.root, e.isMini ? root * 0.4 : root);
  }
  // pull projectiles in? no — sigil also wipes enemy bullets inside it (rewarding defensive casts)
  for (const pr of g.projectiles.live) {
    if (!pr.active || pr.team !== TEAM_ENEMY || pr.lob) continue;
    if ((pr.x - h.x) ** 2 + (pr.y - h.y) ** 2 < h.r * h.r) pr.active = false;
  }
  if (hits > 0) g.requestHitstop(0.5, false, false);
  g.effects.onCastDetonate(g, h, hits);
}
