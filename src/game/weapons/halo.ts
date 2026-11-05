import { TUNING } from '../../config/tuning';
import { EV } from '../events';
import { clamp } from '../math';
import { damageEnemy, explode, hitInfo } from '../combat';
import { firePlayer, PJ, cutProjectiles } from '../projectiles';
import type { Projectile, Slot } from '../entities';
import type { Game } from '../game';
import type { Player } from '../player';
import type { ActionSpec, Weapon } from './types';

const W = TUNING.weapons.halo;

/**
 * Halo — a returning chakram. It cuts on the way out AND on the way back, so you position enemies
 * between yourself and the halo. Every third throw grinds at its apex. Special: it orbits you.
 * States: 0 outward, 1 grinding at apex, 2 returning, 3 orbiting.
 */
interface HaloRT {
  ids: number[];
  throws: number;
}

function rt(p: Player): HaloRT {
  if (!p.wref) p.wref = { ids: [], throws: 0 } as HaloRT;
  return p.wref as HaloRT;
}

// reused every frame (no allocations in the hot path)
const HALO_LIST: Projectile[] = [];
function halos(g: Game, p: Player): Projectile[] {
  const r = rt(p);
  HALO_LIST.length = 0;
  for (const pr of g.projectiles.live) if (pr.active && pr.kind === PJ.Halo && r.ids.indexOf(pr.id) >= 0) HALO_LIST.push(pr);
  r.ids.length = 0;
  for (const h of HALO_LIST) r.ids.push(h.id);
  return HALO_LIST;
}

function throwHalo(g: Game, p: Player, angle: number, finisher: boolean, dmgMul: number, slot: Slot) {
  const S = g.stats;
  const range = W.throw.range * (1 + S.val('haloRange') * 0.3);
  const pr = firePlayer(g, PJ.Halo, p.x, p.y, angle, 0, W.throw.dmg * dmgMul * (1 + S.val('forgeAttack') * 0.2), slot, W.throw.power, W.throw.radius * (finisher ? 1.25 : 1), 'w_halo');
  pr.life = pr.maxLife = 99;
  pr.st = 0;
  pr.sx = p.x;
  pr.sy = p.y;
  const A = g.arena;
  pr.tx = clamp(p.x + Math.cos(angle) * range, A.x0 + 20, A.x1 - 20);
  pr.ty = clamp(p.y + Math.sin(angle) * range, A.y0 + 20, A.y1 - 20);
  pr.a = 0;
  pr.c = 0;
  pr.ref = finisher ? 1 : 0;
  pr.knock = W.throw.knock;
  pr.scale = finisher ? 1.3 : 1;
  pr.speed = 1;
  rt(p).ids.push(pr.id);
  const ev = g.events.push(EV.Shoot, p.x, p.y);
  ev.dx = Math.cos(angle);
  ev.dy = Math.sin(angle);
  ev.key = 'halo';
  return pr;
}

function hitWith(g: Game, pr: Projectile, dirX: number, dirY: number, rehit: boolean) {
  let maxP = -1;
  let crit = false;
  let kill = false;
  for (const e of g.enemies.live) {
    if (!e.targetable) continue;
    const rr = pr.r + e.r;
    if ((e.x - pr.x) ** 2 + (e.y - pr.y) ** 2 > rr * rr) continue;
    if (!rehit && pr.hits.indexOf(e.id) >= 0) continue;
    if (rehit && pr.hits.indexOf(e.id) >= 0) continue;
    pr.hits.push(e.id);
    const info = hitInfo();
    info.slot = pr.slot;
    info.power = pr.power;
    info.knock = pr.knock;
    const l = Math.hypot(dirX, dirY) || 1;
    info.dirX = dirX / l;
    info.dirY = dirY / l;
    info.srcX = pr.x - info.dirX * 30;
    info.srcY = pr.y - info.dirY * 30;
    damageEnemy(g, e, pr.dmg, info);
    if (pr.power > maxP) maxP = pr.power;
    crit = crit || info.outCrit;
    kill = kill || info.outKilled;
  }
  if (maxP >= 0) g.requestHitstop(maxP * 0.8, crit, kill);
  cutProjectiles(g, pr.x, pr.y, pr.r + 6, 0, Math.PI * 2);
}

function update(g: Game, p: Player, dt: number) {
  const list = halos(g, p);
  p.ws.out = list.length;
  const S = g.stats;
  for (const pr of list) {
    pr.a += dt;
    pr.rot += dt * 22;
    const px = pr.x;
    const py = pr.y;
    if (pr.st === 0) {
      const k = Math.min(1, pr.a / (W.throw.outTime * (1 - S.val('haloSpeed') * 0.2)));
      const e = 1 - (1 - k) * (1 - k);
      pr.x = pr.sx + (pr.tx - pr.sx) * e;
      pr.y = pr.sy + (pr.ty - pr.sy) * e;
      hitWith(g, pr, pr.x - px || pr.tx - pr.sx, pr.y - py || pr.ty - pr.sy, false);
      if (k >= 1) {
        pr.hits.length = 0;
        pr.a = 0;
        pr.st = pr.ref ? 1 : 2;
        if (S.has('haloBlast')) explode(g, pr.x, pr.y, 80, pr.dmg * 0.8, 0, 0.5, 'attack', null);
      }
    } else if (pr.st === 1) {
      pr.c -= dt;
      if (pr.c <= 0) {
        pr.c = W.finisher.grindTick;
        pr.hits.length = 0;
        const d = pr.dmg;
        pr.dmg = W.finisher.grindDmg * (1 + S.val('forgeAttack') * 0.2);
        const pw = pr.power;
        pr.power = 0.15;
        hitWith(g, pr, 0, 1, true);
        pr.dmg = d;
        pr.power = pw;
      }
      if (pr.a >= W.finisher.grindTime) {
        pr.st = 2;
        pr.a = 0;
        pr.hits.length = 0;
      }
    } else if (pr.st === 2) {
      const dx = p.x - pr.x;
      const dy = p.y - pr.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = W.throw.returnSpeed * (1 + S.val('haloSpeed') * 0.3) * Math.min(1.6, 0.6 + pr.a * 2.2);
      pr.x += (dx / d) * sp * dt;
      pr.y += (dy / d) * sp * dt;
      hitWith(g, pr, dx, dy, false);
      if (d < 26) {
        pr.active = false;
        const ev = g.events.push(EV.Catch, p.x, p.y);
        ev.n = rt(p).throws;
        p.ws.lastCatch = g.time;
      }
    } else if (pr.st === 3) {
      const R = W.special.orbitRadius;
      pr.b += dt * W.special.angularSpeed;
      pr.x = p.x + Math.cos(pr.b) * R;
      pr.y = p.y + Math.sin(pr.b) * R;
      pr.c -= dt;
      if (pr.c <= 0) {
        pr.c = 0.22;
        pr.hits.length = 0;
      }
      hitWith(g, pr, Math.cos(pr.b), Math.sin(pr.b), false);
      if (pr.a >= W.special.duration + S.val('haloOrbit') * 1.2) {
        pr.st = 2;
        pr.a = 0;
        pr.hits.length = 0;
      }
    }
    pr.vx = (pr.x - px) / Math.max(dt, 1e-4);
    pr.vy = (pr.y - py) / Math.max(dt, 1e-4);
  }
}

function recall(g: Game, p: Player) {
  for (const pr of halos(g, p)) {
    if (pr.st !== 2) {
      pr.st = 2;
      pr.a = 0;
      pr.hits.length = 0;
      const ev = g.events.push(EV.Recall, pr.x, pr.y);
      ev.color = 0xffd36b;
    }
  }
}

const throwSpec: ActionSpec = {
  id: 'haloThrow',
  kind: 'attack',
  windup: 0.03,
  active: 0.02,
  recovery: 0.1,
  moveMul: 0.75,
  track: true,
  chainAt: 0.2,
  active_(g, p) {
    const r = rt(p);
    const quick = g.time - (p.ws.lastCatch ?? -9) < 0.6;
    r.throws = quick ? r.throws + 1 : 1;
    const finisher = r.throws % W.finisherEvery === 0;
    const twin = g.stats.has('haloTwin');
    const mul = finisher ? W.finisher.dmgMul : 1;
    if (twin) {
      throwHalo(g, p, p.actAngle - 0.28, finisher, mul * 0.8, 'attack');
      throwHalo(g, p, p.actAngle + 0.28, finisher, mul * 0.8, 'attack');
    } else throwHalo(g, p, p.actAngle, finisher, mul, 'attack');
  },
};

const orbitSpec: ActionSpec = {
  id: 'haloOrbit',
  kind: 'special',
  windup: 0.03,
  active: 0.02,
  recovery: 0.1,
  moveMul: 0.8,
  chainAt: 0.2,
  active_(g, p) {
    let list = halos(g, p).slice();
    if (!list.length) list = [throwHalo(g, p, p.facing, false, 1, 'special')];
    list.forEach((pr, i) => {
      pr.st = 3;
      pr.a = 0;
      pr.b = Math.atan2(pr.y - p.y, pr.x - p.x) + i * Math.PI;
      pr.slot = 'special';
      pr.dmg = W.special.tickDmg * (1 + g.stats.val('forgeSpecial') * 0.3);
      pr.power = W.special.power;
      pr.hits.length = 0;
      pr.c = 0;
    });
    p.specialCd = W.special.cooldown;
  },
};

const dashThrow: ActionSpec = {
  id: 'haloDash',
  kind: 'dashAttack',
  windup: 0.02,
  active: 0.02,
  recovery: 0.12,
  moveMul: 0.6,
  track: true,
  chainAt: 0.3,
  active_(g, p) {
    const pr = throwHalo(g, p, p.actAngle, false, 1.4, 'dash');
    pr.tx = clamp(p.x + Math.cos(p.actAngle) * W.dashAttack.range, g.arena.x0 + 20, g.arena.x1 - 20);
    pr.ty = clamp(p.y + Math.sin(p.actAngle) * W.dashAttack.range, g.arena.y0 + 20, g.arena.y1 - 20);
    pr.color = g.effects.slotColor(g, 'dash');
  },
};

export const halo: Weapon = {
  id: 'halo',
  name: 'Sunwheel Halo',
  title: 'Returning Chakram',
  desc: 'Throw the halo — it cuts going out and coming back. Catch it fast to build to a grinding finisher. Attack again to recall. Special: orbit.',
  color: 0xffd36b,
  assistRange: W.assistRange,
  ranged: true,
  forges: [
    { id: 'haloTwin', name: 'Twin Halos', desc: 'Throw two halos in a V.', max: 1 },
    { id: 'haloBlast', name: 'Solar Apex', desc: 'Halos explode at the end of their throw.', max: 1 },
    { id: 'haloSpeed', name: 'Swift Wheel', desc: 'Halos fly and return 25% faster.', max: 2 },
    { id: 'haloRange', name: 'Far Flight', desc: 'Halos fly 30% further.', max: 2 },
    { id: 'haloOrbit', name: 'Long Orbit', desc: 'Orbit lasts 1.2s longer.', max: 2 },
  ],
  attack(g, p) {
    const list = halos(g, p);
    const orbiting = list.filter((h) => h.st === 3);
    if (orbiting.length) {
      // fling the orbiting halo(s) from where they are toward the target
      const t = p.target && p.target.targetable ? p.target : null;
      for (const pr of orbiting) {
        const ang = t ? Math.atan2(t.y - pr.y, t.x - pr.x) : p.facing;
        const range = W.throw.range * (1 + g.stats.val('haloRange') * 0.3);
        pr.st = 0;
        pr.a = 0;
        pr.sx = pr.x;
        pr.sy = pr.y;
        pr.tx = clamp(pr.x + Math.cos(ang) * range, g.arena.x0 + 20, g.arena.x1 - 20);
        pr.ty = clamp(pr.y + Math.sin(ang) * range, g.arena.y0 + 20, g.arena.y1 - 20);
        pr.slot = 'attack';
        pr.dmg = W.throw.dmg * 1.3 * (1 + g.stats.val('forgeAttack') * 0.2);
        pr.power = W.throw.power;
        pr.hits.length = 0;
        const ev = g.events.push(EV.Shoot, pr.x, pr.y);
        ev.key = 'halo';
      }
      p.buf.attack = -99;
      return null;
    }
    if (list.length) {
      // only a fresh press recalls (holding attack just auto-throws on every catch)
      if (g.time - p.buf.attack <= TUNING.input.buffer) {
        recall(g, p);
        p.buf.attack = -99;
      }
      return null;
    }
    return throwSpec;
  },
  special() {
    return orbitSpec;
  },
  dashAttack(g, p) {
    if (halos(g, p).length) {
      recall(g, p);
      return null;
    }
    return dashThrow;
  },
  update,
  equip(g, p) {
    p.wref = { ids: [], throws: 0 } as HaloRT;
  },
  specialReady(g, p) {
    return p.specialCd <= 0 ? 1 : 1 - p.specialCd / W.special.cooldown;
  },
};
