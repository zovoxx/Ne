import { Enemy, Hazard, HZ, TEAM_PLAYER, type Element } from '../entities';
import { EV } from '../events';
import type { Game } from '../game';
import { damageEnemy, explode, hitInfo, type HitInfo } from '../combat';
import { addHazard } from '../hazards';
import { ELEMENT_COLOR, type EffectExt, type Effects } from '../effects';
import { TUNING } from '../../config/tuning';

/**
 * Boon mechanics. Everything here reads flags/values from g.stats, which is rebuilt from the
 * player's boons. Adding a boon = data in patrons.ts + (optionally) a reaction here.
 */

// per-dash scratch
const dashHits: number[] = [];
let dashStartX = 0;
let dashStartY = 0;
let lightningCount = 0;

function enemiesNear(g: Game, x: number, y: number, r: number, fn: (e: Enemy, d: number) => void, max = 99) {
  let n = 0;
  for (const e of g.enemies.live) {
    if (!e.targetable) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < r + e.r) {
      fn(e, d);
      if (++n >= max) break;
    }
  }
  return n;
}

function strike(g: Game, e: Enemy, dmg: number, slot: 'dash' | 'cast' | 'other', color: number, power = 0.35) {
  const info = hitInfo();
  info.slot = slot;
  info.power = power;
  info.knock = 0.4;
  info.dirX = 0;
  info.dirY = 1;
  info.srcX = e.x;
  info.srcY = e.y - 20;
  info.pierceShield = true;
  info.noStatus = slot === 'other';
  info.color = color;
  damageEnemy(g, e, dmg, info);
  return info;
}

function lightningFromSky(g: Game, e: Enemy, dmg: number) {
  const ev = g.events.push(EV.Lightning, e.x + 20, e.y - 300);
  ev.dx = e.x;
  ev.dy = e.y;
  strike(g, e, dmg, 'other', ELEMENT_COLOR.storm, 0.4);
}

function fireField(g: Game, x: number, y: number, r: number, life: number) {
  const h = addHazard(g, HZ.Fire, TEAM_PLAYER, x, y, r, life, 0, ELEMENT_COLOR.ember, null);
  h.tick = 0.3;
  return h;
}

function elementBurst(g: Game, el: Element, x: number, y: number, r: number, dmg: number, pow: number, slot: 'dash' | 'cast' | 'other') {
  const ev = g.events.push(EV.CastBoom, x, y);
  ev.amount = r;
  ev.color = ELEMENT_COLOR[el];
  enemiesNear(g, x, y, r, (e) => {
    if (dmg > 0) strike(g, e, dmg, slot, ELEMENT_COLOR[el], 0.3);
    if (e.active) g.effects.applyElement(g, e, el, pow, slot === 'other' ? 'dash' : slot);
  });
}

export function installMechanics(fx: Effects) {
  const ext: Partial<EffectExt> = {
    modifyDamage(g, e, info, mul) {
      const S = g.stats;
      if (e.burn > 0) {
        mul += S.val('vsBurn');
        const ic = S.val('infernoCrown');
        if (ic > 0) mul += Math.min(0.4, ic * e.burn);
      }
      if ((e.data.ionT ?? 0) > g.time) mul += S.val('ionize');
      if (e.bleed > 0) mul += S.val('rending');
      if (S.val('slipstream') > 0 && g.time - g.player.lastDashEndT < 1) mul += S.val('slipstream');
      return mul;
    },

    onHit(g, e, info, dmg, crit) {
      const S = g.stats;
      // dawn dash: next attack after a dash crits (handled in hit info by flag)
      void crit;
      void dmg;
      void S;
      void info;
    },

    onKill(g, e, info) {
      const S = g.stats;
      if (e.burn > 0 && S.val('wildfire') > 0) {
        explode(g, e.x, e.y, 95, S.val('wildfire'), 0, 0.4, 'other', e);
        enemiesNear(g, e.x, e.y, 110, (o) => (o.burn = Math.min(S.burnMax, o.burn + 3)));
      }
      void info;
    },

    onFreeze(g, e) {
      const r = g.stats.val('absZero');
      if (r > 0) {
        enemiesNear(g, e.x, e.y, r, (o) => {
          if (o !== e && o.chill > 0 && o.freeze <= 0) g.effects.freeze(g, o);
        });
      }
    },

    onLightningHit(g, e) {
      if (g.stats.val('ionize') > 0) e.data.ionT = g.time + 3;
    },

    onLightning(g, from, n) {
      const th = g.stats.val('thunderhead');
      if (th <= 0) return;
      lightningCount += n;
      if (lightningCount >= 6) {
        lightningCount = 0;
        const ev = g.events.push(EV.Lightning, from.x, from.y - 320);
        ev.dx = from.x;
        ev.dy = from.y;
        explode(g, from.x, from.y, 120, th, 0, 0.7, 'other', null);
      }
    },

    onDash(g) {
      const p = g.player;
      const S = g.stats;
      dashHits.length = 0;
      dashStartX = p.x;
      dashStartY = p.y;
      const el = S.infuse.dash;
      if (el === 'storm') {
        let n = Math.max(1, Math.round(S.infusePow.dash || 2));
        const targets: Enemy[] = [];
        enemiesNear(g, p.x, p.y, 260, (e) => targets.push(e));
        targets.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
        for (const t of targets) {
          if (n-- <= 0) break;
          lightningFromSky(g, t, S.joltDmg * (1 + S.dashDmg));
        }
      } else if (el === 'ember') {
        fireField(g, p.x, p.y, 34, 2.2);
      }
    },

    onDashEnd(g) {
      const p = g.player;
      const S = g.stats;
      const el = S.infuse.dash;
      if (el === 'ember') {
        fireField(g, (p.x + dashStartX) / 2, (p.y + dashStartY) / 2, 34, 2.2);
        fireField(g, p.x, p.y, 34, 2.2);
      } else if (el === 'rime') {
        elementBurst(g, 'rime', p.x, p.y, 105, 4 * (1 + S.dashDmg), S.infusePow.dash || 3, 'dash');
      }
    },

    onCast(g, h, hits) {
      const S = g.stats;
      const fire = S.val('emberCastField');
      if (fire > 0) fireField(g, h.x, h.y, h.r, fire);
      const storm = S.val('stormCastCloud');
      if (storm > 0) {
        const c = addHazard(g, HZ.Storm, TEAM_PLAYER, h.x, h.y, h.r * 1.1, storm, S.joltDmg * (1 + S.castDmg), ELEMENT_COLOR.storm, null);
        c.tick = 0.42;
      }
      void hits;
    },

    beforeHurt(g, dmg) {
      void g;
      void dmg;
      return 0;
    },

    onHurt(g, dmg, src) {
      const S = g.stats;
      const p = g.player;
      const bd = S.val('backdraft');
      if (bd > 0) {
        explode(g, p.x, p.y, 130, bd, 0, 0.55, 'other', null);
        enemiesNear(g, p.x, p.y, 130, (e) => (e.burn = Math.min(S.burnMax, e.burn + S.val('backdraftBurn'))));
      }
      const gs = S.val('glacialShell');
      if (gs > 0) {
        if (src && src.active) g.effects.freeze(g, src);
        enemiesNear(g, p.x, p.y, 150, (e) => g.effects.applyElement(g, e, 'rime', gs, 'other'));
        p.hurtT += 0.3;
      }
      const sr = S.val('staticRetort');
      if (sr > 0) {
        if (src && src.active) {
          lightningFromSky(g, src, S.joltDmg * 1.5);
          if (src.active) g.effects.chainLightning(g, src, S.joltDmg, sr, 'other');
        } else {
          const t: Enemy[] = [];
          enemiesNear(g, p.x, p.y, 240, (e) => t.push(e), sr);
          for (const e of t) lightningFromSky(g, e, S.joltDmg * 1.5);
        }
      }
      void dmg;
    },

    update(g, dt) {
      const p = g.player;
      const S = g.stats;
      // dash-through damage when a dash boon is equipped
      if (p.dashing && S.infuse.dash) {
        const el = S.infuse.dash;
        for (const e of g.enemies.live) {
          if (!e.targetable || dashHits.indexOf(e.id) >= 0) continue;
          const rr = e.r + p.r + 6;
          if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > rr * rr) continue;
          dashHits.push(e.id);
          const info = hitInfo();
          info.slot = 'dash';
          info.power = 0.3;
          info.knock = 0.5;
          info.dirX = p.dashDx;
          info.dirY = p.dashDy;
          info.srcX = p.x - p.dashDx * 30;
          info.srcY = p.y - p.dashDy * 30;
          info.pierceShield = true;
          damageEnemy(g, e, 6 * TUNING.scaling.dmgByBiome[0], info);
          void el;
        }
      }
      void dt;
    },
  };
  fx.ext = ext;
}

export type { HitInfo, Hazard };
