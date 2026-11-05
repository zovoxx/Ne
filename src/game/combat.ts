import { TUNING } from '../config/tuning';
import { Corpse, Enemy, HB, Hitbox, type Element, type Slot } from './entities';
import { EV } from './events';
import type { Game } from './game';
import { angleDiff, clamp, lerp } from './math';

/** Per-hit parameters. Taken from a small ring so nested hits (chain lightning…) never clobber each other. */
export class HitInfo {
  slot: Slot = 'attack';
  power = 0.3;
  knock = 1;
  dirX = 1;
  dirY = 0;
  srcX = 0;
  srcY = 0;
  critBonus = 0;
  forceCrit = false;
  armorMul = 1;
  isDot = false;
  noHitstop = false;
  launch = false;
  finisher = false;
  pierceShield = false;
  /** skip on-hit status application (status ticks, chain reactions) */
  noStatus = false;
  element: Element | null = null;
  tip = false;
  backstab = false;
  color = 0xffffff;
  outCrit = false;
  outKilled = false;
  outBlocked = false;
  reset() {
    this.slot = 'attack';
    this.power = 0.3;
    this.knock = 1;
    this.dirX = 1;
    this.dirY = 0;
    this.srcX = this.srcY = 0;
    this.critBonus = 0;
    this.forceCrit = false;
    this.armorMul = 1;
    this.isDot = false;
    this.noHitstop = false;
    this.launch = false;
    this.finisher = false;
    this.pierceShield = false;
    this.noStatus = false;
    this.element = null;
    this.tip = false;
    this.backstab = false;
    this.color = 0xffffff;
    this.outCrit = this.outKilled = this.outBlocked = false;
    return this;
  }
}
const RING: HitInfo[] = [];
for (let i = 0; i < 48; i++) RING.push(new HitInfo());
let ringI = 0;
export function hitInfo(): HitInfo {
  ringI = (ringI + 1) % RING.length;
  return RING[ringI].reset();
}

export function hasStatus(e: Enemy) {
  return e.burn > 0 || e.chill > 0 || e.freeze > 0 || e.hex > 0 || e.bleed > 0 || e.jolt > 0 || e.mark > 0;
}

/**
 * The single entry point for damaging enemies. Handles dodges/parries, frontal shields, crits,
 * bubbles, armor, knockback, hit-stun, status application, events and kills.
 * Returns damage dealt to HP (0 if blocked).
 */
export function damageEnemy(g: Game, e: Enemy, base: number, info: HitInfo): number {
  info.outCrit = info.outKilled = info.outBlocked = false;
  if (!e.active || e.hp <= 0 || e.spawnT > 0) return 0;
  if (!info.isDot) {
    if (e.untargetable) return 0;
    if (e.invuln) {
      const ev = g.events.push(EV.Deflect, e.x - info.dirX * e.r, e.y - info.dirY * e.r);
      ev.dx = -info.dirX;
      ev.dy = -info.dirY;
      ev.ref = e;
      info.outBlocked = true;
      return 0;
    }
    if (e.def.onHit && e.def.onHit(e, g, info)) {
      info.outBlocked = true;
      return 0;
    }
    if (e.frontShield > 0 && !info.pierceShield && e.stun <= 0 && e.freeze <= 0) {
      const toSrc = Math.atan2(info.srcY - e.y, info.srcX - e.x);
      if (Math.abs(angleDiff(e.facing, toSrc)) < e.frontShield / 2) {
        const ev = g.events.push(EV.Block, e.x + Math.cos(e.facing) * e.r, e.y + Math.sin(e.facing) * e.r);
        ev.dx = Math.cos(toSrc);
        ev.dy = Math.sin(toSrc);
        ev.power = info.power;
        ev.ref = e;
        if (!e.def.noKnock) {
          e.kx += info.dirX * 120 * info.knock;
          e.ky += info.dirY * 120 * info.knock;
        }
        info.outBlocked = true;
        return 0;
      }
    }
  }
  const S = g.stats;
  let mul = 1 + S.allDmg + S.slotDmg(info.slot) + TUNING.streak.damageBonus[g.streakTier];
  if (hasStatus(e)) mul += S.vsStatusDmg;
  if (e.elite || e.isBoss || e.isMini) mul += S.vsEliteDmg;
  if (e.freeze > 0) mul += S.freezeVuln;
  if (e.hex > 0) mul += S.hexDmgTaken;
  if (e.hp >= e.maxHp && S.firstHitDmg > 0) mul += S.firstHitDmg;
  if (e.data.vuln && (e.stun > 0 || (e.data.vulnT ?? 0) > g.time)) mul += e.data.vuln;
  mul = g.effects.modifyDamage(g, e, info, mul);
  let crit = info.forceCrit;
  const ext = g.effects.ext;
  if (!crit && !info.isDot && ext.forceCrit && ext.forceCrit(g, e, info)) crit = true;
  if (!crit && !info.isDot) {
    let chance = TUNING.crit.baseChance + S.critChance + info.critBonus;
    if (e.mark > 0) chance += S.dawnMarkCrit;
    if (ext.critBonus) chance += ext.critBonus(g, e, info);
    crit = g.rng.next() < chance;
  }
  let dmg = base * mul * (crit ? TUNING.crit.multiplier + S.critMul + (e.mark > 0 ? S.dawnCritDmg : 0) : 1);
  if (e.data.dr) dmg *= 1 - e.data.dr;
  dmg = Math.max(1, Math.round(dmg));
  let shown = dmg;
  if (e.bubble > 0) {
    const ab = Math.min(e.bubble, dmg);
    e.bubble -= ab;
    dmg -= ab;
    if (e.bubble <= 0) {
      const ev = g.events.push(EV.ShieldBreak, e.x, e.y);
      ev.ref = e;
      ev.amount = e.r;
    }
  }
  if (e.shield > 0 && dmg > 0) {
    const ab = Math.min(e.shield, dmg);
    e.shield -= ab;
    dmg -= ab;
    if (e.shield <= 0) {
      const ev = g.events.push(EV.ShieldBreak, e.x, e.y);
      ev.ref = e;
      ev.amount = e.r;
      e.eliteT2 = 6; // regen delay
    }
  }
  if (e.armor > 0 && dmg > 0 && !info.isDot) {
    e.armor -= dmg * info.armorMul;
    dmg = Math.max(0, Math.round(dmg * 0.12));
    if (e.armor <= 0) {
      e.armor = 0;
      e.stun = Math.max(e.stun, 1.6);
      g.interrupt(e);
      const ev = g.events.push(EV.ArmorBreak, e.x, e.y);
      ev.ref = e;
      ev.amount = e.r;
    }
  }
  e.hp -= dmg;
  e.lastHitT = g.time;
  info.outCrit = crit;
  if (!info.isDot) {
    if (!e.def.noKnock) {
      const k = (TUNING.knockback.base * info.knock * (1 + S.knockback)) / e.mass * (e.armor > 0 ? 0.3 : 1);
      e.kx += info.dirX * k;
      e.ky += info.dirY * k;
    }
    if (!e.def.staggerImmune && !e.superArmor && e.armor <= 0) {
      const hs = lerp(TUNING.hitstun.min, TUNING.hitstun.max, clamp(info.power, 0, 1));
      if (hs > e.hitstun) e.hitstun = hs;
      g.interrupt(e);
    }
  }
  const ev = g.events.push(EV.Hit, e.x, e.y);
  ev.dx = info.dirX;
  ev.dy = info.dirY;
  ev.power = info.isDot ? 0 : info.power;
  ev.amount = shown;
  ev.crit = crit;
  ev.ref = e;
  ev.flag = info.isDot ? 1 : info.armorMul > 1 && e.maxArmor > 0 ? 2 : 0;
  ev.color = info.isDot ? info.color : e.def.blood;
  ev.key = info.slot;
  if (!info.noStatus) g.effects.onEnemyHit(g, e, info, dmg, crit);
  if (e.hp <= 0 && e.active) {
    killEnemy(g, e, info, info.slot);
    info.outKilled = true;
  }
  return dmg;
}

export function killEnemy(g: Game, e: Enemy, info: HitInfo | null, slot: Slot) {
  if (!e.active) return;
  e.hp = 0;
  e.killedBy = slot;
  const power = info ? info.power : 0.3;
  e.deathPower = power;
  e.deathDx = info ? info.dirX : 0;
  e.deathDy = info ? info.dirY : 1;
  e.deathCrit = info ? info.outCrit : false;
  const canLaunch = !e.isBoss && !e.isMini && !e.def.noKnock && e.mass < 4 && !e.untargetable;
  const launch = !!info && !info.isDot && canLaunch && (info.launch || power >= 0.7);
  let style = 0;
  if (launch) style = 2;
  else if (e.freeze > 0 || (info && info.outCrit)) style = 1;
  const ev = g.events.push(EV.Kill, e.x, e.y);
  ev.dx = e.deathDx;
  ev.dy = e.deathDy;
  ev.power = power;
  ev.crit = e.deathCrit;
  ev.flag = style;
  ev.ref = e;
  ev.color = e.def.blood;
  ev.amount = e.r;
  ev.n = g.streakTier;
  ev.key = e.def.art;
  if (launch) {
    const c = g.corpses.obtain();
    c.reset();
    c.def = e.def;
    c.x = e.x;
    c.y = e.y;
    const sp = 700 + 700 * power;
    c.vx = e.deathDx * sp;
    c.vy = e.deathDy * sp;
    c.r = e.r;
    c.spin = (g.rng.next() < 0.5 ? -1 : 1) * (14 + power * 10);
    c.life = 0.42;
    c.dmg = Math.round(8 + e.maxHp * 0.25);
    c.elite = e.elite;
  }
  g.kills++;
  if (g.mode === 'play') g.addStreak();
  g.lastKillX = e.x;
  g.lastKillY = e.y;
  e.def.onDeath?.(e, g);
  g.effects.onEnemyKilled(g, e, info);
  g.removeEnemy(e);
  g.room?.onEnemyKilled(g, e);
}

// ───────────────────────── player hitboxes ─────────────────────────

export function spawnHitbox(g: Game, slot: Slot, shape: number, angle: number, life: number): Hitbox {
  const h = g.hitboxes.obtain();
  h.reset();
  h.slot = slot;
  h.shape = shape;
  h.angle = angle;
  h.life = life;
  const p = g.player;
  h.x = p.x;
  h.y = p.y;
  return h;
}

function overlaps(h: Hitbox, e: Enemy): number {
  const dx = e.x - h.x;
  const dy = e.y - h.y;
  if (h.shape === HB.Circle) {
    const rr = h.radius + e.r;
    return dx * dx + dy * dy <= rr * rr ? 1 : 0;
  }
  if (h.shape === HB.Arc) {
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > h.range + e.r) return 0;
    if (h.arc >= Math.PI * 1.99 || d < e.r + 6) return 1;
    const ang = Math.abs(angleDiff(h.angle, Math.atan2(dy, dx)));
    return ang <= h.arc / 2 + Math.atan2(e.r, Math.max(1, d)) ? 1 : 0;
  }
  // rect along angle starting at origin
  const c = Math.cos(h.angle);
  const s = Math.sin(h.angle);
  const u = dx * c + dy * s;
  const v = Math.abs(-dx * s + dy * c);
  if (u < -e.r - 10 || u > h.len + e.r) return 0;
  if (v > h.width / 2 + e.r) return 0;
  // return 2 for tip hits
  if (h.tip > 0 && u > h.len * (1 - h.tip)) return 2;
  return 1;
}

export function updateHitboxes(g: Game, dt: number) {
  const p = g.player;
  const list = g.hitboxes.live;
  for (let i = 0; i < list.length; i++) {
    const h = list[i];
    if (!h.active) continue;
    if (h.follow) {
      h.x = p.x + Math.cos(h.angle) * h.offset;
      h.y = p.y + Math.sin(h.angle) * h.offset;
    }
    let maxPower = -1;
    let anyCrit = false;
    let anyKill = false;
    const enemies = g.enemies.live;
    for (let j = 0; j < enemies.length; j++) {
      const e = enemies[j];
      if (!e.active || e.spawnT > 0 || e.untargetable) continue;
      const idx = h.hits.indexOf(e.id);
      if (idx >= 0) {
        if (h.rehit <= 0 || g.time - h.hitTimes[idx] < h.rehit) continue;
      }
      const o = overlaps(h, e);
      if (!o) continue;
      if (idx >= 0) h.hitTimes[idx] = g.time;
      else {
        h.hits.push(e.id);
        h.hitTimes.push(g.time);
      }
      const info = hitInfo();
      info.slot = h.slot;
      info.power = h.power;
      info.knock = h.knock;
      let dx = e.x - p.x;
      let dy = e.y - p.y;
      if (h.shape === HB.Rect || h.flags & 8) {
        dx = Math.cos(h.angle);
        dy = Math.sin(h.angle);
      }
      const d = Math.hypot(dx, dy) || 1;
      info.dirX = dx / d;
      info.dirY = dy / d;
      info.srcX = p.x;
      info.srcY = p.y;
      info.critBonus = h.critBonus;
      info.armorMul = h.armorMul;
      info.finisher = h.finisher;
      info.launch = (h.flags & 2) !== 0;
      if (o === 2) {
        info.tip = true;
        info.critBonus += (h.ref as number) || 0.5;
      }
      if (h.flags & 1) {
        const toP = Math.atan2(p.y - e.y, p.x - e.x);
        if (Math.abs(angleDiff(e.facing, toP)) > (2 * Math.PI) / 3) {
          info.backstab = true;
          info.critBonus += TUNING.weapons.fangs.backstabCritBonus;
        }
      }
      damageEnemy(g, e, h.dmg, info);
      if (info.outBlocked) {
        if (maxPower < 0.2) maxPower = 0.2;
        continue;
      }
      if (h.power > maxPower) maxPower = h.power;
      anyCrit = anyCrit || info.outCrit;
      anyKill = anyKill || info.outKilled;
    }
    if (maxPower >= 0 && !(h.flags & 4)) g.requestHitstop(maxPower, anyCrit, anyKill);
    h.life -= dt;
    if (h.life <= 0) h.active = false;
  }
}

// ───────────────────────── corpses (fly-back deaths) ─────────────────────────

export function updateCorpses(g: Game, dt: number) {
  const A = g.arena;
  for (const c of g.corpses.live) {
    if (!c.active) continue;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.rot += c.spin * dt;
    const fr = Math.exp(-3.5 * dt);
    c.vx *= fr;
    c.vy *= fr;
    c.life -= dt;
    // bounce off walls
    let bounced = false;
    if (c.x < A.x0 + c.r) {
      c.x = A.x0 + c.r;
      c.vx = Math.abs(c.vx) * 0.5;
      bounced = true;
    } else if (c.x > A.x1 - c.r) {
      c.x = A.x1 - c.r;
      c.vx = -Math.abs(c.vx) * 0.5;
      bounced = true;
    }
    if (c.y < A.y0 + c.r) {
      c.y = A.y0 + c.r;
      c.vy = Math.abs(c.vy) * 0.5;
      bounced = true;
    } else if (c.y > A.y1 - c.r) {
      c.y = A.y1 - c.r;
      c.vy = -Math.abs(c.vy) * 0.5;
      bounced = true;
    }
    if (bounced) {
      const ev = g.events.push(EV.Slam, c.x, c.y);
      ev.power = 0.6;
      ev.color = c.def.blood;
      c.life = Math.min(c.life, 0.05);
    }
    const speed = Math.hypot(c.vx, c.vy);
    if (speed > 260) {
      for (const e of g.enemies.live) {
        if (!e.targetable) continue;
        if (c.hits.indexOf(e.id) >= 0) continue;
        const rr = c.r + e.r;
        if ((e.x - c.x) ** 2 + (e.y - c.y) ** 2 > rr * rr) continue;
        c.hits.push(e.id);
        const info = hitInfo();
        info.slot = 'other';
        info.power = 0.6;
        info.knock = 1.6;
        info.dirX = c.vx / speed;
        info.dirY = c.vy / speed;
        info.srcX = c.x;
        info.srcY = c.y;
        info.pierceShield = true;
        info.noStatus = true;
        info.launch = true;
        const ev = g.events.push(EV.Chain, e.x, e.y);
        ev.dx = info.dirX;
        ev.dy = info.dirY;
        ev.color = c.def.blood;
        damageEnemy(g, e, c.dmg, info);
        g.requestHitstop(0.55, false, info.outKilled);
        c.vx *= 0.55;
        c.vy *= 0.55;
      }
    }
    if (c.life <= 0) {
      c.active = false;
      const ev = g.events.push(EV.Shatter, c.x, c.y);
      ev.ref = c;
      ev.color = c.def.blood;
      ev.amount = c.r;
      ev.key = c.def.art;
    }
  }
}

// ───────────────────────── status ticking ─────────────────────────

export function tickEnemyStatus(g: Game, e: Enemy, dt: number) {
  const S = g.stats;
  if (e.burn > 0) {
    e.burnTick -= dt;
    if (e.burnTick <= 0) {
      e.burnTick = 0.5;
      const info = hitInfo();
      info.isDot = true;
      info.slot = 'other';
      info.noStatus = true;
      info.color = 0xff8a3d;
      info.element = 'ember';
      damageEnemy(g, e, Math.max(1, e.burn * S.burnDps * 0.5), info);
      e.burn = Math.floor(e.burn * (0.86 - S.burnDecay));
      if (!e.active) return;
    }
  }
  if (e.chill > 0 && e.freeze <= 0) {
    e.chillDecay += dt;
    if (e.chillDecay > 1.2) {
      e.chillDecay = 0;
      e.chill--;
    }
  }
  if (e.hex > 0) e.hex = Math.max(0, e.hex - dt);
  if (e.mark > 0) e.mark = Math.max(0, e.mark - dt);
  if (e.jolt > 0) e.jolt = Math.max(0, e.jolt - dt);
}

/** Radial damage (explosions, slams). Team: 0 = hurts enemies, 1 = hurts the player, 2 = both. */
export function explode(g: Game, x: number, y: number, radius: number, dmg: number, team: number, power: number, slot: Slot = 'other', owner: Enemy | null = null) {
  const ev = g.events.push(EV.Explosion, x, y);
  ev.amount = radius;
  ev.power = power;
  ev.flag = team;
  if (team === 0 || team === 2) {
    for (const e of g.enemies.live) {
      if (!e.targetable || e === owner) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.hypot(dx, dy);
      if (d > radius + e.r) continue;
      const info = hitInfo();
      info.slot = slot;
      info.power = power;
      info.knock = 1.4;
      info.dirX = d > 0 ? dx / d : 0;
      info.dirY = d > 0 ? dy / d : 1;
      info.srcX = x;
      info.srcY = y;
      info.pierceShield = true;
      info.noStatus = slot === 'other';
      damageEnemy(g, e, dmg, info);
    }
  }
  if (team === 1 || team === 2) {
    const p = g.player;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius + p.r * 0.6) g.hurtPlayer(dmg, x, y, owner);
  }
}

export function makeCorpseStub(): Corpse {
  return new Corpse();
}
