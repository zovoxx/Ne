import { Enemy, HZ, TEAM_PLAYER, type Element } from '../entities';
import { EV } from '../events';
import type { Game } from '../game';
import { damageEnemy, explode, hitInfo } from '../combat';
import { addHazard } from '../hazards';
import { ELEMENT_COLOR, type EffectExt, type Effects } from '../effects';
import { firePlayer, nearestEnemy, PJ } from '../projectiles';
import { TUNING } from '../../config/tuning';

/**
 * Boon mechanics for all eight Lights and their duos. Everything reads flags/values from
 * g.stats (rebuilt from the player's boons). A boon = data in patrons.ts + a reaction here.
 */

const dashHits: number[] = [];
let dashStartX = 0;
let dashStartY = 0;
let lightningCount = 0;
let maelT = 0;
let staticT = 0;

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

function strike(g: Game, e: Enemy, dmg: number, slot: 'dash' | 'cast' | 'other', color: number, power = 0.35, statusOk = false) {
  const info = hitInfo();
  info.slot = slot;
  info.power = power;
  info.knock = 0.4;
  info.dirX = 0;
  info.dirY = 1;
  info.srcX = e.x;
  info.srcY = e.y - 20;
  info.pierceShield = true;
  info.noStatus = !statusOk;
  info.color = color;
  damageEnemy(g, e, dmg, info);
  return info;
}

function lightningFromSky(g: Game, e: Enemy, dmg: number) {
  const ev = g.events.push(EV.Lightning, e.x + 20, e.y - 300);
  ev.dx = e.x;
  ev.dy = e.y;
  const info = strike(g, e, dmg, 'other', ELEMENT_COLOR.storm, 0.4);
  afterLightningHit(g, e);
  return info;
}

function fireField(g: Game, x: number, y: number, r: number, life: number) {
  const h = addHazard(g, HZ.Fire, TEAM_PLAYER, x, y, r, life, 0, ELEMENT_COLOR.ember, null);
  h.tick = 0.3;
  return h;
}

function vortex(g: Game, x: number, y: number, r: number, life: number, dmg: number, color: number, speed = 0, angle = 0) {
  const h = addHazard(g, HZ.Vortex, TEAM_PLAYER, x, y, r, life, dmg, color, null);
  h.tick = 0.35;
  h.b = speed;
  h.angle = angle;
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

function pushAway(g: Game, x: number, y: number, r: number, force: number) {
  enemiesNear(g, x, y, r, (e, d) => {
    if (e.def.noKnock) return;
    const k = force / e.mass;
    e.kx += ((e.x - x) / (d || 1)) * k;
    e.ky += ((e.y - y) / (d || 1)) * k;
    e.data.tideT = g.time + 1.2;
  });
}

function windBlade(g: Game, x: number, y: number, angle: number, dmg = 10) {
  const pr = firePlayer(g, PJ.Blade, x, y, angle, 820, dmg, 'other', 0.25, 12, 'windBlade');
  pr.pierce = 2;
  pr.life = pr.maxLife = 0.5;
  pr.color = ELEMENT_COLOR.gale;
  pr.knock = 0.6;
  return pr;
}

function afterLightningHit(g: Game, e: Enemy) {
  const S = g.stats;
  if (!e.active) return;
  if (S.val('ionize') > 0) e.data.ionT = g.time + 3;
  if (S.val('plasma') > 0) e.burn = Math.min(S.burnMax, e.burn + S.val('plasma'));
  if (S.val('staticFrost') > 0) g.effects.applyElement(g, e, 'rime', S.val('staticFrost'), 'other');
  if (S.val('rideLightning') > 0 && g.player.dashCd > 0) g.player.dashCd = Math.max(0, g.player.dashCd - 0.06);
}

function onHexDeath(g: Game, e: Enemy) {
  const S = g.stats;
  if (S.val('siphon') > 0) g.healPlayer(S.val('siphon'));
  if (S.val('blackSun') > 0 && g.rng.chance(S.val('blackSun'))) {
    const p = g.player;
    if (p.castCharges < TUNING.cast.charges + S.castCharges) {
      p.castCharges++;
      const ev = g.events.push(EV.Text, p.x, p.y - 30);
      ev.key = 'SIGIL +1';
    }
  }
  if (S.val('drowned') > 0) vortex(g, e.x, e.y, 80, 1.5, 4, ELEMENT_COLOR.tide);
}

export function installMechanics(fx: Effects) {
  const ext: Partial<EffectExt> = {
    forceCrit(g, e, info) {
      const S = g.stats;
      const p = g.player;
      if (S.val('zenith') > 0 && e.hp >= e.maxHp && !e.data.zen) {
        e.data.zen = 1;
        return true;
      }
      if (p.nextCrits > 0 && (info.slot === 'attack' || info.slot === 'dash') && g.time < p.nextCritT) {
        p.nextCrits--;
        return true;
      }
      return false;
    },

    critBonus(g, e, info) {
      const S = g.stats;
      let b = 0;
      if (info.slot === 'special') b += S.val('dawnSpecialCrit');
      if (S.val('solarFlare') > 0 && e.burn > 0) b += 0.12;
      if (S.val('eclipse') > 0 && e.hex > 0) b += 0.15;
      if (S.val('sunlit') > 0) b += e.bleed * S.val('sunlit');
      return b;
    },

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
      if (S.val('staticFrost') > 0 && e.freeze > 0 && info.element === 'storm') mul += 0.4;
      return mul;
    },

    afterElement(g, e, el) {
      const S = g.stats;
      if (el === 'umbra' && S.val('dread') > 0) {
        e.slow = Math.max(e.slow, S.val('dread'));
        e.slowT = Math.max(e.slowT, 5);
      }
    },

    chillNeedMod(g, e) {
      return g.stats.val('blackIce') > 0 && e.hex > 0 ? Math.floor(g.stats.chillMax / 2) : 0;
    },

    onFreeze(g, e) {
      const S = g.stats;
      const r = S.val('absZero');
      if (r > 0)
        enemiesNear(g, e.x, e.y, r, (o) => {
          if (o !== e && o.chill > 0 && o.freeze <= 0) g.effects.freeze(g, o);
        });
      if (S.val('steam') > 0 && e.burn > 0) {
        const dmg = e.burn * S.val('steam');
        e.burn = 0;
        explode(g, e.x, e.y, 115, dmg, 0, 0.6, 'other', null);
      }
    },

    onLightningHit(g, e) {
      afterLightningHit(g, e);
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

    onBleedBurst(g, e, stacks) {
      const S = g.stats;
      if (S.val('bloodletting') > 0) g.healPlayer(S.val('bloodletting'));
      if (S.val('wildthorn') > 0 && e.active) e.burn = Math.min(S.burnMax, e.burn + stacks);
      if (S.val('bloodMoon') > 0) {
        if (e.active) g.effects.applyElement(g, e, 'umbra', 1, 'other');
        g.healPlayer(S.val('bloodMoon'));
      }
      const tt = S.val('thousandThorns');
      if (tt > 0) {
        const half = Math.max(1, Math.floor(stacks / 2));
        enemiesNear(
          g,
          e.x,
          e.y,
          170,
          (o) => {
            if (o === e) return;
            o.bleed = Math.min(S.bleedMax, o.bleed + half);
            const ev = g.events.push(EV.Chain, o.x, o.y);
            ev.color = ELEMENT_COLOR.thorn;
          },
          tt + 1,
        );
      }
    },

    onHit(g, e, info, dmg, crit) {
      const S = g.stats;
      if (!crit || !e.active) return;
      if (S.val('glare') > 0 && e.mark > 0) enemiesNear(g, e.x, e.y, 180, (o) => o !== e && (o.mark = Math.max(o.mark, 3)), S.val('glare') + 1);
      if (S.val('morningStar') > 0 && info.slot !== 'other') {
        const ev = g.events.push(EV.StatusProc, e.x, e.y);
        ev.color = ELEMENT_COLOR.dawn;
        enemiesNear(g, e.x, e.y, 75, (o) => o !== e && strike(g, o, S.val('morningStar'), 'other', ELEMENT_COLOR.dawn, 0.2));
      }
      if (S.val('solarFlare') > 0) e.burn = Math.min(S.burnMax, e.burn + S.val('solarFlare'));
      if (S.val('eclipse') > 0) enemiesNear(g, e.x, e.y, 160, (o) => (o.hex = Math.max(o.hex, 5)), 3);
      void dmg;
    },

    onKill(g, e, info) {
      const S = g.stats;
      if (e.burn > 0 && S.val('wildfire') > 0) {
        explode(g, e.x, e.y, 95, S.val('wildfire'), 0, 0.4, 'other', e);
        enemiesNear(g, e.x, e.y, 110, (o) => (o.burn = Math.min(S.burnMax, o.burn + 3)));
      }
      if (e.hex > 0) onHexDeath(g, e);
      void info;
    },

    onSlam(g, e) {
      const S = g.stats;
      if (S.val('boiling') > 0) {
        explode(g, e.x, e.y, 80, S.val('boiling'), 0, 0.5, 'other', null);
        fireField(g, e.x, e.y, 40, 2);
      }
      if (S.val('glacier') > 0 && e.active) g.effects.freeze(g, e);
      if (S.val('thunderwave') > 0 && e.active) g.effects.chainLightning(g, e, S.joltDmg, S.joltChains, 'other');
    },

    onKnockCollide(g, a, b, speed) {
      const rip = g.stats.val('riptide');
      if (rip <= 0 || !b.targetable) return;
      if ((b.data.ripT ?? 0) > g.time) return;
      b.data.ripT = g.time + 0.4;
      const ev = g.events.push(EV.Chain, b.x, b.y);
      ev.color = ELEMENT_COLOR.tide;
      strike(g, b, rip, 'other', ELEMENT_COLOR.tide, 0.4);
      void a;
      void speed;
    },

    onAction(g, kind) {
      const S = g.stats;
      const p = g.player;
      if (kind === 'special' && S.val('galeSpecial') > 0) {
        const n = S.val('galeSpecial');
        for (let i = 0; i < n; i++) windBlade(g, p.x, p.y, p.facing + (i - (n - 1) / 2) * 0.3, 10 * (1 + S.specialDmg));
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
      } else if (el === 'ember') fireField(g, p.x, p.y, 34, 2.2);
      else if (el === 'thorn') {
        const h = addHazard(g, HZ.Bramble, TEAM_PLAYER, p.x, p.y, 46, 3, 3, ELEMENT_COLOR.thorn, null);
        h.tick = 0.4;
      }
      if (S.val('galeDash') > 0) {
        const a = Math.atan2(p.dashDy, p.dashDx);
        for (let i = -1; i <= 1; i++) windBlade(g, p.x, p.y, a + i * 0.25, 9 * (1 + S.dashDmg));
      }
      if (S.val('dawnDash') > 0 || S.val('sunstreak') > 0) {
        p.nextCrits = Math.max(1, S.val('sunstreak'));
        p.nextCritT = g.time + 1.6;
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
      } else if (el === 'tide') {
        const ev = g.events.push(EV.CastBoom, p.x, p.y);
        ev.amount = 110;
        ev.color = ELEMENT_COLOR.tide;
        enemiesNear(g, p.x, p.y, 110, (e) => strike(g, e, (S.infusePow.dash || 12) * (1 + S.dashDmg), 'dash', ELEMENT_COLOR.tide, 0.4));
        pushAway(g, p.x, p.y, 120, 820);
      } else if (el === 'dawn') {
        enemiesNear(g, p.x, p.y, 120, (e) => (e.mark = Math.max(e.mark, 3)));
      }
    },

    onCast(g, h, hits) {
      const S = g.stats;
      const p = g.player;
      const fire = S.val('emberCastField');
      if (fire > 0) fireField(g, h.x, h.y, h.r, fire);
      const storm = S.val('stormCastCloud');
      if (storm > 0) {
        const c = addHazard(g, HZ.Storm, TEAM_PLAYER, h.x, h.y, h.r * 1.1, storm, S.joltDmg * (1 + S.castDmg), ELEMENT_COLOR.storm, null);
        c.tick = 0.42;
      }
      if (S.val('tideCast') > 0) pushAway(g, h.x, h.y, h.r * 1.5, 1100);
      if (S.val('dawnCast') > 0) {
        const z = addHazard(g, HZ.Radiance, TEAM_PLAYER, h.x, h.y, h.r, S.val('dawnCast'), 0, ELEMENT_COLOR.dawn, null);
        z.tick = 0.3;
      }
      if (S.val('umbraCast') > 0) vortex(g, h.x, h.y, h.r, 1.1, 3, ELEMENT_COLOR.umbra);
      if (S.val('thornCast') > 0) {
        const b = addHazard(g, HZ.Bramble, TEAM_PLAYER, h.x, h.y, h.r, S.val('thornCast'), 4, ELEMENT_COLOR.thorn, null);
        b.tick = 0.45;
      }
      if (S.val('maelstrom') > 0) vortex(g, h.x, h.y, 95, 3.2, 7, ELEMENT_COLOR.tide, 110, p.facing);
      else if (S.val('galeCast') > 0) vortex(g, h.x, h.y, 80, S.val('galeCast'), 6, ELEMENT_COLOR.gale, 150, p.facing);
      void hits;
    },

    beforeHurt(g, dmg) {
      const p = g.player;
      if (p.barrier <= 0) return 0;
      const ab = Math.min(p.barrier, dmg);
      p.barrier -= ab;
      const ev = g.events.push(EV.Deflect, p.x, p.y);
      ev.color = ELEMENT_COLOR.tide;
      return ab;
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
      const bw = S.val('breakwater');
      if (bw > 0) {
        p.barrier = Math.max(p.barrier, bw);
        pushAway(g, p.x, p.y, 150, 900);
      }
      const mercy = S.val('mercy');
      if (mercy > 0) {
        g.healPlayer(mercy);
        enemiesNear(g, p.x, p.y, 170, (e) => (e.stun = Math.max(e.stun, 1)));
        const ev = g.events.push(EV.CastBoom, p.x, p.y);
        ev.amount = 170;
        ev.color = ELEMENT_COLOR.dawn;
      }
      const ur = S.val('umbralRecoil');
      if (ur > 0) enemiesNear(g, p.x, p.y, ur, (e) => (e.hex = Math.max(e.hex, 6)));
      const up = S.val('updraft');
      if (up > 0) {
        p.buffSpeed = up;
        p.buffDodge = 0.3;
        p.buffSpeedT = 2;
      }
      const barb = S.val('barbed');
      if (barb > 0 && src && src.active) {
        strike(g, src, barb, 'other', ELEMENT_COLOR.thorn, 0.4);
        if (src.active) src.bleed = Math.min(S.bleedMax, src.bleed + 3);
      }
      void dmg;
    },

    onProjectileHit(g, pr, e) {
      if (pr.kind === PJ.Blade && g.stats.val('cuts') > 0 && e.active) e.bleed = Math.min(g.stats.bleedMax, e.bleed + g.stats.val('cuts'));
    },

    update(g, dt) {
      const p = g.player;
      const S = g.stats;
      // dash-through hits when any dash boon is equipped
      if (p.dashing && (S.infuse.dash || S.val('eyeStorm') > 0 || S.val('rideLightning') > 0)) {
        for (const e of g.enemies.live) {
          if (!e.targetable || dashHits.indexOf(e.id) >= 0) continue;
          const rr = e.r + p.r + 6;
          if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > rr * rr) continue;
          dashHits.push(e.id);
          if (S.infuse.dash) {
            const info = hitInfo();
            info.slot = 'dash';
            info.power = 0.3;
            info.knock = 0.5;
            info.dirX = p.dashDx;
            info.dirY = p.dashDy;
            info.srcX = p.x - p.dashDx * 30;
            info.srcY = p.y - p.dashDy * 30;
            info.pierceShield = true;
            damageEnemy(g, e, 7 * TUNING.scaling.dmgByBiome[Math.min(3, g.biome)], info);
          }
          if (!e.active) continue;
          if (S.val('cuts') > 0) e.bleed = Math.min(S.bleedMax, e.bleed + S.val('cuts'));
          if (S.val('rideLightning') > 0) g.effects.chainLightning(g, e, S.joltDmg, S.joltChains, 'other');
          const eye = S.val('eyeStorm');
          if (eye > 0) {
            const hit: number[] = [e.id];
            for (let i = 0; i < eye; i++) {
              const t = nearestEnemy(g, p.x, p.y, 380, null, hit);
              if (!t) break;
              hit.push(t.id);
              windBlade(g, p.x, p.y, Math.atan2(t.y - p.y, t.x - p.x), 12);
            }
          }
        }
      }
      // legendary: maelstrom heart
      const mh = S.val('maelHeart');
      if (mh > 0) {
        maelT -= dt;
        if (maelT <= 0) {
          maelT = mh;
          vortex(g, p.x, p.y, 90, 1.6, 4, ELEMENT_COLOR.tide);
        }
      }
      // duo: black static
      const bs = S.val('blackStatic');
      if (bs > 0) {
        staticT -= dt;
        if (staticT <= 0) {
          staticT = 1;
          const hexed = g.enemies.live.filter((e) => e.targetable && e.hex > 0);
          for (const e of hexed) {
            const t = nearestEnemy(g, e.x, e.y, 260, e);
            if (t && t.hex > 0) {
              const ev = g.events.push(EV.Lightning, e.x, e.y);
              ev.dx = t.x;
              ev.dy = t.y;
              strike(g, t, bs, 'other', ELEMENT_COLOR.storm, 0.2);
            }
          }
        }
      }
    },

    onRoomStart() {
      maelT = 1.5;
      staticT = 1;
      lightningCount = 0;
    },
  };
  fx.ext = ext;
}
