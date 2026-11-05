import type { EnemyDef } from './types';
import { faceTo, kite, moveTo, playerInArc, playerNear, setState, stop, tgCircle, tgCone, tgLine, toPlayer } from './ai';
import { fireEnemy, PJ } from '../projectiles';
import { addHazard } from '../hazards';
import { EV } from '../events';
import { angleDiff, clamp, DEG, rotateTowards, TAU } from '../math';
import { Enemy, HZ, TEAM_ENEMY } from '../entities';
import type { Game } from '../game';
import { PH } from '../player';

/* ═══════════════════════ BIOME 2 — THE DROWNED ARCHIVE ═══════════════════════ */

function blinkTo(g: Game, e: Enemy, x: number, y: number) {
  const ev = g.events.push(EV.Teleport, e.x, e.y);
  ev.color = 0x47d6ff;
  e.x = e.px = x;
  e.y = e.py = y;
  const ev2 = g.events.push(EV.Teleport, x, y);
  ev2.color = 0x47d6ff;
}

/** TELEPORTER: vanishes, reappears behind you (marked by an ink circle) and slashes. */
export const inkshade: EnemyDef = {
  id: 'inkshade',
  name: 'Inkshade',
  blurb: 'Teleporter. Watch for the ink circle behind you — it appears there and slashes.',
  biome: 2,
  roles: ['disrupt'],
  hp: 40,
  speed: 120,
  radius: 16,
  mass: 1,
  contact: 0,
  dmg: 10,
  art: 'inkshade',
  blood: 0x47d6ff,
  cost: 2,
  flying: true,
  orient: 'flip',
  init(e) {
    e.cd = 0.8;
  },
  update(e, g, dt) {
    const p = g.player;
    const t = toPlayer(e, g);
    switch (e.st) {
      case 0:
        kite(e, g, 170, 320, e.def.speed);
        e.facing = t.a;
        e.cd -= dt;
        if (e.cd <= 0) {
          setState(e, 1);
          stop(e);
          e.visual = 2;
          const side = g.rng.chance(0.6) ? Math.PI : g.rng.sign() * 1.7;
          const a = (p.moving ? Math.atan2(p.moveY, p.moveX) : p.facing) + side;
          e.tx = clamp(p.x + Math.cos(a) * 85, g.arena.x0 + 30, g.arena.x1 - 30);
          e.ty = clamp(p.y + Math.sin(a) * 85, g.arena.y0 + 30, g.arena.y1 - 30);
          e.tg = tgCircle(g, e, e.tx, e.ty, 34, 0.5, 0x47d6ff);
        }
        break;
      case 1:
        stop(e);
        e.untargetable = e.t > 0.1;
        if (e.t >= 0.5) {
          g.clearTelegraphs(e);
          blinkTo(g, e, e.tx, e.ty);
          e.untargetable = false;
          e.visual = 0;
          e.a = Math.atan2(p.y - e.y, p.x - e.x);
          e.facing = e.a;
          setState(e, 2);
          e.tg = tgCone(g, e, e.a, 96, 110 * DEG, 0.34);
        }
        break;
      case 2:
        stop(e);
        if (e.t < 0.15) {
          e.a = rotateTowards(e.a, t.a, 4 * dt);
          if (e.tg) e.tg.angle = e.a;
        }
        if (e.t >= 0.34) {
          g.clearTelegraphs(e);
          if (playerInArc(e, g, 96, 110 * DEG, e.a)) g.hurtPlayer(e.def.dmg * e.dmgMul, e.x, e.y, e);
          const ev = g.events.push(EV.Slam, e.x + Math.cos(e.a) * 40, e.y + Math.sin(e.a) * 40);
          ev.color = 0x47d6ff;
          ev.power = 0.3;
          setState(e, 3);
        }
        break;
      case 3:
        stop(e);
        if (e.t > 0.55) {
          setState(e, 0);
          e.cd = 2.2;
        }
        break;
    }
  },
};

/** SNIPER: tracking laser that locks (turns white) then fires a piercing bolt. Break line of sight. */
export const lanternist: EnemyDef = {
  id: 'lanternist',
  name: 'Lanternist',
  blurb: 'Sniper. Its laser locks white before firing — sidestep or hide behind a pillar.',
  biome: 2,
  roles: ['back'],
  hp: 36,
  speed: 150,
  radius: 16,
  mass: 1,
  contact: 0,
  dmg: 13,
  art: 'lanternist',
  blood: 0x7fe3ff,
  cost: 2.2,
  max: 3,
  orient: 'flip',
  init(e) {
    e.cd = 1.2;
  },
  update(e, g, dt) {
    const p = g.player;
    const t = toPlayer(e, g);
    e.cd2 -= dt;
    switch (e.st) {
      case 0:
        kite(e, g, 360, 580, e.def.speed);
        e.facing = t.a;
        e.cd -= dt;
        if (t.d < 150 && e.cd2 <= 0) {
          const pt = g.freePointNear(e.x, e.y, 260, 360, e.r);
          blinkTo(g, e, pt.x, pt.y);
          e.cd2 = 4;
        }
        if (e.cd <= 0 && !g.segmentBlocked(e.x, e.y, p.x, p.y)) {
          setState(e, 1);
          stop(e);
          e.a = t.a;
          e.tg = tgLine(g, e, e.a, 1100, 6, 1.4, 0xff3b4a);
        }
        break;
      case 1:
        stop(e);
        if (e.t < 1.1) e.a = rotateTowards(e.a, t.a, 2.6 * dt);
        else if (e.tg) e.tg.locked = true;
        e.facing = e.a;
        if (e.tg) {
          e.tg.x = e.x;
          e.tg.y = e.y;
          e.tg.angle = e.a;
        }
        if (e.t >= 1.4) {
          g.clearTelegraphs(e);
          const pr = fireEnemy(g, e, PJ.Bolt, e.x + Math.cos(e.a) * 20, e.y + Math.sin(e.a) * 20, e.a, 1250, e.def.dmg, 8, 'bolt', 0x7fe3ff);
          pr.pierce = 99;
          pr.reflectable = false;
          setState(e, 2);
        }
        break;
      case 2:
        stop(e);
        if (e.t > 0.6) {
          setState(e, 0);
          e.cd = 2.4;
        }
        break;
    }
    void p;
  },
};

/** TETHER PAIR: two scribes joined by a burning line. Kill both within 3 seconds or the first returns. */
export const scribe: EnemyDef = {
  id: 'scribe',
  name: 'Twinned Scribe',
  blurb: 'Tether pair. Don’t cross the beam. Kill both within 3s or the fallen one revives.',
  biome: 2,
  roles: ['zone', 'disrupt'],
  hp: 44,
  speed: 170,
  radius: 16,
  mass: 1,
  contact: 0,
  dmg: 9,
  art: 'scribe',
  blood: 0xffe0a0,
  cost: 1.6,
  group: 2,
  flying: true,
  orient: 'none',
  init(e, g) {
    // pair with an unpaired scribe if one exists
    for (const o of g.enemies.live) {
      if (o !== e && o.active && o.def.id === 'scribe' && !o.link && !o.data.reviveT) {
        linkScribes(g, o, e);
        return;
      }
    }
    e.a = g.rng.range(0, TAU);
  },
  update(e, g, dt) {
    const p = g.player;
    const L = e.link;
    // revive countdown when the partner fell
    if (e.data.reviveT) {
      e.data.reviveT -= dt;
      if (e.data.reviveT <= 0) {
        e.data.reviveT = 0;
        const n = g.spawnEnemy(scribe, e.data.rx, e.data.ry, { summoned: true });
        n.hp = Math.round(n.maxHp * 0.5);
        g.clearTelegraphs(e);
        linkScribes(g, e, n);
        const ev = g.events.push(EV.Revive, n.x, n.y);
        ev.ref = n;
      }
    }
    if (L && L.active && L.id < e.id) {
      e.a = L.a + Math.PI; // follower: opposite side
      e.b = L.b;
    } else {
      e.b = (e.b || 1) * 1;
      e.a += dt * 0.95 * (e.b || 1);
      if (g.rng.next() < dt * 0.15) e.b = -(e.b || 1);
    }
    const r = 175 + Math.sin(g.time * 1.7 + e.id) * 30;
    moveTo(e, g, p.x + Math.cos(e.a) * r, p.y + Math.sin(e.a) * r, e.def.speed);
    e.facing = Math.atan2(p.y - e.y, p.x - e.x);
  },
  onDeath(e, g) {
    const L = e.link;
    if (L && L.active) {
      L.link = null;
      L.data.reviveT = 3;
      L.data.rx = e.x;
      L.data.ry = e.y;
      L.tg = tgCircle(g, L, e.x, e.y, 26, 3, 0xffe0a0);
    }
  },
};

function linkScribes(g: Game, a: Enemy, b: Enemy) {
  a.link = b;
  b.link = a;
  if (!a.a) a.a = g.rng.range(0, TAU);
  b.a = a.a + Math.PI;
  const h = addHazard(g, HZ.Tether, TEAM_ENEMY, a.x, a.y, 0, 9999, a.def.dmg, 0xffd27a, a);
  h.linkA = a;
  h.linkB = b;
  h.w = 7;
}

/** HEALER: keeps away from you and restores the most wounded ally (green beam warns you). */
export const tidecleric: EnemyDef = {
  id: 'tidecleric',
  name: 'Tidecleric',
  blurb: 'Healer. Its green beam restores allies — interrupt it or kill it first.',
  biome: 2,
  roles: ['support'],
  hp: 46,
  speed: 155,
  radius: 17,
  mass: 1.2,
  contact: 0,
  dmg: 0,
  art: 'tidecleric',
  blood: 0x5dffc4,
  cost: 2.2,
  max: 2,
  orient: 'flip',
  init(e) {
    e.cd = 1.5;
  },
  update(e, g, dt) {
    switch (e.st) {
      case 0: {
        kite(e, g, 300, 470, e.def.speed);
        e.cd -= dt;
        if (e.cd <= 0) {
          let best: Enemy | null = null;
          let bk = 0.92;
          for (const o of g.enemies.live) {
            if (!o.targetable || o === e || o.isBoss || o.def.id === 'tidecleric') continue;
            if ((o.data.healedT ?? 0) > g.time) continue;
            if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 > 420 * 420) continue;
            const k = o.hp / o.maxHp;
            if (k < bk) {
              bk = k;
              best = o;
            }
          }
          if (best) {
            e.link = best;
            setState(e, 1);
            stop(e);
            e.tg = tgLine(g, e, 0, 10, 10, 0.6, 0x5dffc4);
          } else e.cd = 0.8;
        }
        break;
      }
      case 1: {
        stop(e);
        const o = e.link;
        if (!o || !o.active) {
          g.clearTelegraphs(e);
          setState(e, 0);
          e.cd = 0.6;
          break;
        }
        if (e.tg) {
          e.tg.x = e.x;
          e.tg.y = e.y;
          e.tg.angle = Math.atan2(o.y - e.y, o.x - e.x);
          e.tg.len = Math.hypot(o.x - e.x, o.y - e.y);
        }
        if (e.t >= 0.6) {
          g.clearTelegraphs(e);
          const amt = Math.round(o.maxHp * 0.28);
          o.data.healedT = g.time + 4;
          o.hp = Math.min(o.maxHp, o.hp + amt);
          const ev = g.events.push(EV.Heal, o.x, o.y);
          ev.amount = amt;
          ev.flag = 1;
          const b = g.events.push(EV.Beam, e.x, e.y);
          b.dx = o.x;
          b.dy = o.y;
          b.color = 0x5dffc4;
          setState(e, 0);
          e.cd = 2.6;
        }
        break;
      }
    }
  },
};

/** GRAPPLER: fires a hook along a line; if it lands you're yanked in for a bite. Dash breaks the pull. */
export const hookjaw: EnemyDef = {
  id: 'hookjaw',
  name: 'Hookjaw',
  blurb: 'Grappler. Its hook drags you in — sidestep the line or dash to break free.',
  biome: 2,
  roles: ['disrupt', 'back'],
  hp: 56,
  speed: 135,
  radius: 19,
  mass: 1.8,
  contact: 0,
  dmg: 12,
  art: 'hookjaw',
  blood: 0x47d6ff,
  cost: 2.3,
  max: 3,
  orient: 'flip',
  init(e) {
    e.cd = 1.4;
  },
  update(e, g, dt) {
    const t = toPlayer(e, g);
    switch (e.st) {
      case 0:
        kite(e, g, 170, 310, e.def.speed);
        e.facing = t.a;
        e.cd -= dt;
        if (e.cd <= 0 && t.d < 380) {
          setState(e, 1);
          stop(e);
          e.a = t.a;
          e.tg = tgLine(g, e, e.a, 390, 26, 0.58);
        }
        break;
      case 1:
        stop(e);
        if (e.t < 0.36) e.a = t.a;
        else if (e.tg) e.tg.locked = true;
        e.facing = e.a;
        if (e.tg) {
          e.tg.x = e.x;
          e.tg.y = e.y;
          e.tg.angle = e.a;
        }
        if (e.t >= 0.58) {
          g.clearTelegraphs(e);
          const pr = fireEnemy(g, e, PJ.Hook, e.x, e.y, e.a, 980, e.def.dmg, 13, 'hook', 0x9fe7ff);
          pr.life = pr.maxLife = 0.4;
          pr.reflectable = false;
          setState(e, 2);
        }
        break;
      case 2: // waiting for the hook
        stop(e);
        if (e.t > 0.9) setState(e, 6);
        break;
      case 5: // hooked the player: bite when close
        stop(e);
        if (!e.tg && (g.player.pullT <= 0 || t.d < 70)) e.tg = tgCone(g, e, t.a, 84, 100 * DEG, 0.24);
        if (e.tg) {
          e.tg.angle = t.a;
          if (e.tg.t >= 0.24) {
            g.clearTelegraphs(e);
            if (playerInArc(e, g, 84, 100 * DEG, t.a)) g.hurtPlayer(e.def.dmg * e.dmgMul, e.x, e.y, e);
            setState(e, 6);
          }
        }
        if (e.t > 1.4) {
          g.clearTelegraphs(e);
          setState(e, 6);
        }
        break;
      case 6:
        stop(e);
        if (e.t > 0.6) {
          setState(e, 0);
          e.cd = 2.6;
        }
        break;
    }
  },
};

/** SPLITTER: ink blob that hops at you and splits in two when killed — twice. */
export const slurry: EnemyDef = {
  id: 'slurry',
  name: 'Slurry',
  blurb: 'Splitter. Splits into smaller blobs when killed. Crowd control shines here.',
  biome: 2,
  roles: ['front', 'swarm'],
  hp: 62,
  speed: 0,
  radius: 26,
  mass: 2,
  contact: 0,
  dmg: 8,
  art: 'slurry',
  blood: 0x2a6cff,
  cost: 2,
  orient: 'flip',
  init(e) {
    e.data.tier = 2;
  },
  update(e, g, dt) {
    const t = toPlayer(e, g);
    const tier = e.data.tier ?? 2;
    switch (e.st) {
      case 0:
        e.vx *= 0.8;
        e.vy *= 0.8;
        e.data.windup = e.t > 0.25 ? 1 : 0;
        if (e.t > 0.42 - tier * 0.04) {
          e.data.windup = 0;
          e.a = t.a + (Math.random() - 0.5) * 0.4;
          setState(e, 1);
          e.b = 0;
        }
        break;
      case 1: {
        const sp = 330 + (2 - tier) * 60;
        e.vx = Math.cos(e.a) * sp;
        e.vy = Math.sin(e.a) * sp;
        e.flying = true;
        if (e.t > 0.3) {
          e.flying = false;
          stop(e);
          if (!e.b && playerNear(e, g, e.r + 14)) g.hurtPlayer(e.def.dmg * e.dmgMul * (0.6 + tier * 0.2), e.x, e.y, e);
          const ev = g.events.push(EV.Slam, e.x, e.y + e.r * 0.4);
          ev.power = 0.15 + tier * 0.1;
          ev.color = 0x2a6cff;
          setState(e, 0);
        }
        break;
      }
    }
    e.facing = t.a;
    void dt;
  },
  onDeath(e, g) {
    const tier = e.data.tier ?? 2;
    if (tier <= 0) return;
    for (let i = 0; i < 2; i++) {
      const a = e.deathDx || e.deathDy ? Math.atan2(e.deathDy, e.deathDx) + (i ? 1.3 : -1.3) : i * Math.PI;
      const c = g.spawnEnemy(slurry, e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10, { portal: false, summoned: true });
      c.data.tier = tier - 1;
      c.r = tier - 1 === 1 ? 18 : 12;
      c.maxHp = c.hp = Math.round(e.maxHp * (tier - 1 === 1 ? 0.42 : 0.38));
      c.mass = tier - 1 === 1 ? 1.2 : 0.6;
      c.kx = Math.cos(a) * 380;
      c.ky = Math.sin(a) * 380;
      c.st = 0;
      c.t = -0.25;
    }
  },
};

/** DODGER: reads your attacks and sidesteps them, then counters with needles. Bait it, or use AoE. */
export const echo: EnemyDef = {
  id: 'echo',
  name: 'Echo',
  blurb: 'Dodger. Sidesteps attacks aimed at it — bait the dodge, or use your Sigil.',
  biome: 2,
  roles: ['disrupt', 'back'],
  hp: 32,
  speed: 175,
  radius: 15,
  mass: 0.8,
  contact: 0,
  dmg: 7,
  art: 'echo',
  blood: 0xd6f4ff,
  cost: 1.8,
  unlock: 1,
  flying: true,
  orient: 'flip',
  init(e) {
    e.cd = 1.4;
  },
  update(e, g, dt) {
    const p = g.player;
    const t = toPlayer(e, g);
    e.cd2 -= dt;
    // reactive dodge
    if (e.st < 3 && e.cd2 <= 0 && e.root <= 0 && p.act && (p.phase === PH.Windup || p.phase === PH.Active) && t.d < 190) {
      const aimed = Math.abs(angleDiff(p.actAngle, Math.atan2(e.y - p.y, e.x - p.x))) < 0.75;
      if (aimed) {
        setState(e, 3);
        g.clearTelegraphs(e);
        e.untargetable = true;
        e.visual = 2;
        const side = g.rng.sign();
        e.a = t.a + side * Math.PI * 0.5 + Math.PI * 0.15 * side;
        e.cd2 = 1.7;
      }
    }
    switch (e.st) {
      case 0:
        kite(e, g, 150, 270, e.def.speed);
        e.facing = t.a;
        e.cd -= dt;
        if (e.cd <= 0) {
          setState(e, 4);
          e.data.windup = 1;
        }
        break;
      case 3: // sidestep
        e.vx = Math.cos(e.a) * 640;
        e.vy = Math.sin(e.a) * 640;
        if (e.t > 0.18) {
          e.untargetable = false;
          e.visual = 0;
          setState(e, 4);
          e.data.windup = 1;
        }
        break;
      case 4: // counter windup
        stop(e);
        e.facing = t.a;
        if (e.t > 0.32) {
          e.data.windup = 0;
          for (let k = -1; k <= 1; k++) fireEnemy(g, e, PJ.Needle, e.x, e.y, t.a + k * 0.22, 560, e.def.dmg, 6, 'needle', 0xd6f4ff);
          setState(e, 0);
          e.cd = 2.4;
        }
        break;
      default:
        setState(e, 0);
    }
  },
};

/** MINE DROPPER: drifting jellyfish that seeds the floor with mines (they beep before blowing). */
export const glimmerjelly: EnemyDef = {
  id: 'glimmerjelly',
  name: 'Glimmerjelly',
  blurb: 'Mine dropper. Leaves mines that arm and beep — lure enemies over them or steer clear.',
  biome: 2,
  roles: ['zone'],
  hp: 42,
  speed: 80,
  radius: 18,
  mass: 1,
  contact: 0,
  dmg: 12,
  art: 'glimmerjelly',
  blood: 0xff7ae0,
  cost: 1.9,
  unlock: 1,
  flying: true,
  max: 2,
  orient: 'none',
  init(e, g) {
    e.cd = 0.8;
    e.tx = e.x;
    e.ty = e.y;
    void g;
  },
  update(e, g, dt) {
    const p = g.player;
    if (Math.hypot(e.tx - e.x, e.ty - e.y) < 20 || e.t > 3) {
      const pt = g.freePointNear(p.x, p.y, 90, 300, e.r);
      e.tx = pt.x;
      e.ty = pt.y;
      e.t = 0;
    }
    moveTo(e, g, e.tx, e.ty, e.def.speed);
    e.cd -= dt;
    if (e.cd <= 0) {
      let mine = 0;
      for (const h of g.hazards.live) if (h.active && h.owner === e && h.kind === HZ.Mine) mine++;
      if (mine < 5) {
        const h = addHazard(g, HZ.Mine, TEAM_ENEMY, e.x, e.y + 8, 62, 9, e.def.dmg, 0xff7ae0, e);
        h.armT = 0.6;
      }
      e.cd = 1.6;
    }
  },
};

export const BIOME2: EnemyDef[] = [inkshade, lanternist, scribe, tidecleric, hookjaw, slurry, echo, glimmerjelly];
