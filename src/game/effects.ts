import { TUNING } from '../config/tuning';
import { Enemy, Hazard, HZ, Pickup, Projectile, TEAM_PLAYER, type Element, type Slot } from './entities';
import { EV } from './events';
import type { Game } from './game';
import { damageEnemy, explode, hitInfo, type HitInfo } from './combat';

export const ELEMENT_COLOR: Record<Element, number> = {
  ember: 0xff7a2a,
  rime: 0x8fe8ff,
  storm: 0xffe24a,
  tide: 0x3d9bff,
  dawn: 0xfff1a6,
  umbra: 0xb45cff,
  gale: 0x8dffc8,
  thorn: 0x86e04a,
};

/**
 * Hooks that connect combat to the build (boons / duos) and to elite modifiers.
 * Patron mechanics read flags from g.stats (see boons/patrons.ts).
 */
export class Effects {
  /** elite hooks are installed by enemies/elites.ts to avoid import cycles */
  eliteApply: ((g: Game, e: Enemy, mask: number) => void) | null = null;
  eliteUpdate: ((g: Game, e: Enemy, dt: number) => void) | null = null;
  eliteDeath: ((g: Game, e: Enemy) => void) | null = null;
  /** boon mechanics installed by boons/mechanics.ts */
  ext: Partial<EffectExt> = {};

  slotColor(g: Game, slot: Slot): number {
    const el = g.stats.infuse[slot];
    if (el) return ELEMENT_COLOR[el];
    if (slot === 'cast') return 0xd9b8ff;
    return g.weapon ? g.weapon.color : 0xffffff;
  }

  applyElite(g: Game, e: Enemy, mask: number) {
    this.eliteApply?.(g, e, mask);
  }
  updateElite(g: Game, e: Enemy, dt: number) {
    if (e.elite) this.eliteUpdate?.(g, e, dt);
  }

  // ───────────────────────── elements ─────────────────────────

  applyElement(g: Game, e: Enemy, el: Element, pow: number, slot: Slot) {
    if (!e.active || pow <= 0) return;
    const S = g.stats;
    switch (el) {
      case 'ember':
        e.burn = Math.min(S.burnMax, e.burn + Math.max(1, Math.round(2 * pow)));
        if (e.burnTick <= 0) e.burnTick = 0.5;
        break;
      case 'rime': {
        if (e.freeze > 0) break;
        e.chill += Math.max(1, Math.round(2 * pow));
        e.chillDecay = 0;
        const need = Math.max(3, S.chillMax - (this.ext.chillNeedMod?.(g, e) ?? 0));
        if (e.chill >= need) this.freeze(g, e);
        break;
      }
      case 'storm':
        if (e.jolt <= 0) {
          e.jolt = 0.32;
          this.chainLightning(g, e, S.joltDmg * pow, S.joltChains, slot);
        }
        break;
      case 'tide':
        if (!e.def.noKnock) {
          const p = g.player;
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const k = (TUNING.knockback.base * S.tideKnock * pow) / e.mass;
          e.kx += (dx / d) * k;
          e.ky += (dy / d) * k;
        }
        e.data.tideT = g.time + 1.2;
        break;
      case 'dawn':
        e.mark = Math.max(e.mark, 2.5 + pow);
        break;
      case 'umbra':
        e.hex = Math.max(e.hex, 5 + pow);
        break;
      case 'gale':
        e.slow = 0.3;
        e.slowT = 1.2;
        if (!e.def.noKnock) {
          const p = g.player;
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          e.kx += (dx / d) * 160 * pow;
          e.ky += (dy / d) * 160 * pow;
        }
        break;
      case 'thorn':
        e.bleed = Math.min(S.bleedMax, e.bleed + Math.max(1, Math.round(pow)));
        break;
    }
    this.ext.afterElement?.(g, e, el, pow, slot);
  }

  freeze(g: Game, e: Enemy) {
    if (e.isBoss) {
      e.chill = 0;
      e.stun = Math.max(e.stun, 0.4);
      return;
    }
    e.freeze = g.stats.freezeTime * (e.isMini ? 0.4 : 1);
    e.chill = 0;
    g.interrupt(e);
    const ev = g.events.push(EV.Freeze, e.x, e.y);
    ev.ref = e;
    ev.amount = e.r;
    this.ext.onFreeze?.(g, e);
  }

  chainLightning(g: Game, from: Enemy, dmg: number, chains: number, slot: Slot) {
    const S = g.stats;
    const hit: number[] = [from.id];
    let cur: Enemy = from;
    const range = S.joltRange * (1 + S.val('arcReach'));
    for (let i = 0; i < chains; i++) {
      let best: Enemy | null = null;
      let bd = range * range;
      for (const e of g.enemies.live) {
        if (!e.targetable || hit.indexOf(e.id) >= 0) continue;
        const d = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2;
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      if (!best) break;
      hit.push(best.id);
      const ev = g.events.push(EV.Lightning, cur.x, cur.y);
      ev.dx = best.x;
      ev.dy = best.y;
      const info = hitInfo();
      info.slot = 'other';
      info.power = 0.25;
      info.knock = 0.2;
      const d = Math.sqrt(bd) || 1;
      info.dirX = (best.x - cur.x) / d;
      info.dirY = (best.y - cur.y) / d;
      info.srcX = cur.x;
      info.srcY = cur.y;
      info.noStatus = true;
      info.pierceShield = true;
      info.color = ELEMENT_COLOR.storm;
      info.element = 'storm';
      if (S.val('overcharge') > 0 && g.rng.chance(S.val('overcharge'))) info.forceCrit = true;
      damageEnemy(g, best, dmg, info);
      this.ext.onLightningHit?.(g, best, info);
      cur = best;
    }
    if (hit.length > 1) this.ext.onLightning?.(g, from, hit.length - 1);
  }

  burstBleed(g: Game, e: Enemy) {
    if (e.bleed <= 0 || !e.active) return;
    const stacks = e.bleed;
    e.bleed = 0;
    const info = hitInfo();
    info.slot = 'other';
    info.isDot = true;
    info.noStatus = true;
    info.color = ELEMENT_COLOR.thorn;
    const ev = g.events.push(EV.StatusProc, e.x, e.y);
    ev.key = 'bleed';
    ev.color = ELEMENT_COLOR.thorn;
    ev.amount = stacks;
    damageEnemy(g, e, stacks * g.stats.bleedBurst, info);
    this.ext.onBleedBurst?.(g, e, stacks);
  }

  // ───────────────────────── combat hooks ─────────────────────────

  modifyDamage(g: Game, e: Enemy, info: HitInfo, mul: number): number {
    return this.ext.modifyDamage ? this.ext.modifyDamage(g, e, info, mul) : mul;
  }

  onEnemyHit(g: Game, e: Enemy, info: HitInfo, dmg: number, crit: boolean) {
    const S = g.stats;
    const el = S.infuse[info.slot];
    if (el) this.applyElement(g, e, el, S.infusePow[info.slot] || 1, info.slot);
    if (e.bleed > 0 && (info.slot === 'special' || info.finisher || info.slot === 'cast')) this.burstBleed(g, e);
    if (S.lifeSteal > 0 && dmg > 0 && !info.isDot) g.healPlayer(dmg * S.lifeSteal);
    this.ext.onHit?.(g, e, info, dmg, crit);
  }

  onEnemyKilled(g: Game, e: Enemy, info: HitInfo | null) {
    const S = g.stats;
    if (e.hex > 0 && (S.hexBurst > 0 || S.hexSpread > 0) && S.val('hexOn') > 0) {
      explode(g, e.x, e.y, 105, S.hexBurst, 0, 0.45, 'other', e);
      let spread = S.hexSpread;
      for (const o of g.enemies.live) {
        if (spread <= 0) break;
        if (!o.targetable || o === e) continue;
        if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 220 * 220) {
          o.hex = Math.max(o.hex, 5);
          spread--;
          const ev = g.events.push(EV.Chain, o.x, o.y);
          ev.color = ELEMENT_COLOR.umbra;
        }
      }
    }
    if (e.freeze > 0 && S.shatterDmg > 0) explode(g, e.x, e.y, 110, S.shatterDmg, 0, 0.5, 'other', e);
    if (e.elite) this.eliteDeath?.(g, e);
    this.ext.onKill?.(g, e, info);
  }

  onWallSlam(g: Game, e: Enemy, speed: number) {
    const S = g.stats;
    let dmg = Math.round(e.maxHp * 0.04 + 4);
    const tide = (e.data.tideT ?? 0) > g.time;
    if (tide) dmg += S.tideSlamDmg;
    const ev = g.events.push(EV.Slam, e.x, e.y);
    ev.power = Math.min(1, speed / 900);
    ev.color = e.def.blood;
    const info = hitInfo();
    info.slot = 'other';
    info.isDot = true;
    info.noStatus = true;
    info.color = tide ? ELEMENT_COLOR.tide : 0xffffff;
    e.kx *= -0.25;
    e.ky *= -0.25;
    damageEnemy(g, e, dmg, info);
    if (e.active && !e.def.staggerImmune) e.stun = Math.max(e.stun, 0.35);
    this.ext.onSlam?.(g, e, tide);
  }

  onDash(g: Game) {
    this.ext.onDash?.(g);
  }
  onDashEnd(g: Game) {
    this.ext.onDashEnd?.(g);
  }
  onCastDetonate(g: Game, h: Hazard, hits: number) {
    this.ext.onCast?.(g, h, hits);
  }
  beforePlayerHurt(g: Game, dmg: number, src: Enemy | null): number {
    return this.ext.beforeHurt ? this.ext.beforeHurt(g, dmg, src) : 0;
  }
  onPlayerHurt(g: Game, dmg: number, src: Enemy | null) {
    this.ext.onHurt?.(g, dmg, src);
  }
  onPickup(g: Game, k: Pickup) {
    this.ext.onPickup?.(g, k);
  }
  onLobLand(g: Game, p: Projectile) {}
  onPlayerProjectileHit(g: Game, p: Projectile, e: Enemy, info: HitInfo) {
    this.ext.onProjectileHit?.(g, p, e, info);
  }
  update(g: Game, dt: number) {
    this.ext.update?.(g, dt);
  }
  onRoomStart(g: Game) {
    this.ext.onRoomStart?.(g);
  }
  onRoomClear(g: Game) {
    const S = g.stats;
    if (S.healOnRoomClear > 0) g.healPlayer(S.healOnRoomClear);
    this.ext.onRoomClear?.(g);
  }
}

export interface EffectExt {
  chillNeedMod(g: Game, e: Enemy): number;
  afterElement(g: Game, e: Enemy, el: Element, pow: number, slot: Slot): void;
  onFreeze(g: Game, e: Enemy): void;
  onLightningHit(g: Game, e: Enemy, info: HitInfo): void;
  onLightning(g: Game, from: Enemy, n: number): void;
  onBleedBurst(g: Game, e: Enemy, stacks: number): void;
  modifyDamage(g: Game, e: Enemy, info: HitInfo, mul: number): number;
  onHit(g: Game, e: Enemy, info: HitInfo, dmg: number, crit: boolean): void;
  onKill(g: Game, e: Enemy, info: HitInfo | null): void;
  onSlam(g: Game, e: Enemy, tide: boolean): void;
  onDash(g: Game): void;
  onDashEnd(g: Game): void;
  onCast(g: Game, h: Hazard, hits: number): void;
  beforeHurt(g: Game, dmg: number, src: Enemy | null): number;
  onHurt(g: Game, dmg: number, src: Enemy | null): void;
  onPickup(g: Game, k: Pickup): void;
  onProjectileHit(g: Game, p: Projectile, e: Enemy, info: HitInfo): void;
  update(g: Game, dt: number): void;
  onRoomStart(g: Game): void;
  onRoomClear(g: Game): void;
}

export const _unused = { HZ, TEAM_PLAYER };
