import type { EnemyDef } from './types';
import { kite, leadPlayer, moveTo, playerNear, setState, stop, tgCircle, tgLine, toPlayer, rayToWall } from './ai';
import { lob } from '../projectiles';
import { addHazard, addPulse } from '../hazards';
import { explode } from '../combat';
import { EV } from '../events';
import { clamp, TAU } from '../math';
import { Enemy, HZ, TEAM_ENEMY } from '../entities';
import type { Game } from '../game';

/* ═══════════════════════ BIOME 3 — THE CLOCKWORK FOUNDRY ═══════════════════════ */

/** FLANKER PACK: three hounds spread around you and pounce from different angles. */
export const rivethound: EnemyDef = {
  id: 'rivethound',
  name: 'Rivet Hound',
  blurb: 'Pack flanker. They surround you, then pounce — keep them in front of you.',
  biome: 3,
  roles: ['front', 'swarm'],
  hp: 32,
  speed: 270,
  radius: 15,
  mass: 1,
  contact: 0,
  dmg: 9,
  art: 'rivethound',
  blood: 0xffb347,
  cost: 1.3,
  group: 3,
  orient: 'flip',
  init(e, g) {
    // spread the pack around the player
    let n = 0;
    for (const o of g.enemies.live) if (o.active && o.def.id === 'rivethound') n++;
    e.a = (n % 3) * ((TAU / 3) * 1.0) + g.rng.range(-0.3, 0.3);
    e.cd = g.rng.range(0.6, 1.4);
  },
  update(e, g, dt) {
    const p = g.player;
    const t = toPlayer(e, g);
    switch (e.st) {
      case 0: {
        e.a += dt * 0.5;
        const tx = p.x + Math.cos(e.a) * 175;
        const ty = p.y + Math.sin(e.a) * 175;
        moveTo(e, g, tx, ty, e.def.speed);
        e.facing = t.a;
        e.cd -= dt;
        if (e.cd <= 0 && t.d < 260) {
          setState(e, 1);
          stop(e);
          e.c = t.a;
          e.tg = tgLine(g, e, e.c, 230, 26, 0.42);
        }
        break;
      }
      case 1:
        stop(e);
        if (e.t < 0.22) e.c = t.a;
        else if (e.tg) e.tg.locked = true;
        e.facing = e.c;
        if (e.tg) {
          e.tg.x = e.x;
          e.tg.y = e.y;
          e.tg.angle = e.c;
        }
        if (e.t >= 0.42) {
          g.clearTelegraphs(e);
          setState(e, 2);
          e.superArmor = true;
          e.b = 0;
        }
        break;
      case 2:
        e.vx = Math.cos(e.c) * 700;
        e.vy = Math.sin(e.c) * 700;
        if (!e.b && playerNear(e, g, e.r + 2)) {
          if (g.hurtPlayer(e.def.dmg * e.dmgMul, e.x, e.y, e)) e.b = 1;
        }
        if (e.t > 0.3) {
          e.superArmor = false;
          setState(e, 3);
        }
        break;
      case 3:
        e.vx *= 0.8;
        e.vy *= 0.8;
        if (e.t > 0.45) {
          setState(e, 0);
          e.a = Math.atan2(e.y - p.y, e.x - p.x);
          e.cd = g.rng.range(1.3, 2.2);
        }
        break;
    }
  },
};

/** TRAP LAYER: places pylons near you; pylons link into electric fences. */
export const coilsentry: EnemyDef = {
  id: 'coilsentry',
  name: 'Coil Sentry',
  blurb: 'Trap layer. Plants pylons that link into lightning fences — smash the pylons.',
  biome: 3,
  roles: ['zone', 'support'],
  hp: 42,
  speed: 140,
  radius: 16,
  mass: 1.2,
  contact: 0,
  dmg: 10,
  art: 'coilsentry',
  blood: 0x7fe3ff,
  cost: 2.2,
  max: 2,
  orient: 'flip',
  init(e) {
    e.cd = 0.8;
  },
  update(e, g, dt) {
    const p = g.player;
    switch (e.st) {
      case 0:
        kite(e, g, 240, 400, e.def.speed);
        e.cd -= dt;
        if (e.cd <= 0 && e.children < 3) {
          setState(e, 1);
          stop(e);
          const a = g.rng.range(0, TAU);
          const d = g.rng.range(110, 190);
          e.tx = clamp(p.x + Math.cos(a) * d, g.arena.x0 + 40, g.arena.x1 - 40);
          e.ty = clamp(p.y + Math.sin(a) * d, g.arena.y0 + 40, g.arena.y1 - 40);
          e.tg = tgCircle(g, e, e.tx, e.ty, 22, 0.5, 0x7fe3ff);
          e.data.windup = 1;
        }
        break;
      case 1:
        stop(e);
        if (e.t >= 0.5) {
          g.clearTelegraphs(e);
          e.data.windup = 0;
          const pyl = g.spawnEnemy(pylon, e.tx, e.ty, { summoned: true, parent: e, portal: false });
          e.children++;
          // link to other pylons of this sentry within range
          for (const o of g.enemies.live) {
            if (o === pyl || !o.active || o.def.id !== 'pylon' || o.parent !== e) continue;
            if (Math.hypot(o.x - pyl.x, o.y - pyl.y) > 330) continue;
            const h = addHazard(g, HZ.Fence, TEAM_ENEMY, o.x, o.y, 0, 9999, e.def.dmg, 0x7fe3ff, e);
            h.linkA = o;
            h.linkB = pyl;
            h.w = 9;
            h.armT = 0.9;
            h.x2 = pyl.x;
            h.y2 = pyl.y;
          }
          setState(e, 0);
          e.cd = 3.2;
        }
        break;
    }
  },
  onRemove(e, g) {
    for (const o of g.enemies.live) if (o.active && o.parent === e && o.def.id === 'pylon') g.kill(o);
  },
};

export const pylon: EnemyDef = {
  id: 'pylon',
  name: 'Pylon',
  blurb: 'Summon. Fence post.',
  biome: 3,
  roles: ['zone'],
  hp: 16,
  speed: 0,
  radius: 11,
  mass: 9,
  contact: 0,
  dmg: 0,
  art: 'pylon',
  blood: 0x7fe3ff,
  cost: 0,
  noKnock: true,
  noElite: true,
  optional: true,
  orient: 'none',
  update(e) {
    stop(e);
  },
  onRemove(e) {
    if (e.parent && e.parent.active) e.parent.children = Math.max(0, e.parent.children - 1);
  },
};

/** ARMORED: plating absorbs damage until broken (heavy hits break it faster), then it's stunned. */
export const ironclad: EnemyDef = {
  id: 'ironclad',
  name: 'Ironclad',
  blurb: 'Armored. Break its plating (heavy hits work best), then punish the stun.',
  biome: 3,
  roles: ['tank'],
  hp: 70,
  speed: 72,
  radius: 26,
  mass: 4,
  contact: 0,
  dmg: 13,
  art: 'ironclad',
  blood: 0xc8d2e6,
  cost: 3,
  armor: 80,
  superArmor: true,
  noKnock: true,
  max: 2,
  orient: 'flip',
  init(e) {
    e.data.vuln = 0.4;
    e.cd = 1;
  },
  update(e, g, dt) {
    const t = toPlayer(e, g);
    e.superArmor = e.armor > 0 || e.st === 1;
    switch (e.st) {
      case 0:
        moveTo(e, g, g.player.x, g.player.y, e.def.speed * (e.armor > 0 ? 1 : 1.4));
        e.facing = t.a;
        e.cd -= dt;
        if (e.cd <= 0 && t.d < 140) {
          setState(e, 1);
          stop(e);
          e.tg = tgCircle(g, e, e.x, e.y, 130, 0.85);
        }
        break;
      case 1:
        stop(e);
        if (e.t >= 0.85) {
          g.clearTelegraphs(e);
          explode(g, e.x, e.y, 130, e.def.dmg * e.dmgMul, 1, 0.9, 'other', e);
          addPulse(g, e.x, e.y, 260, 0.5, e.def.dmg * 0.6, 0xffb347, e, 22);
          setState(e, 2);
        }
        break;
      case 2:
        stop(e);
        if (e.t > 0.9) {
          setState(e, 0);
          e.cd = 1.4;
        }
        break;
    }
  },
};

/** ARTILLERY: lobs three shells around you with staggered landings. */
export const forgemortar: EnemyDef = {
  id: 'forgemortar',
  name: 'Forge Mortar',
  blurb: 'Artillery. Shells land on and around you one after another.',
  biome: 3,
  roles: ['back', 'zone'],
  hp: 50,
  speed: 0,
  radius: 20,
  mass: 5,
  contact: 0,
  dmg: 12,
  art: 'forgemortar',
  blood: 0xff7a2a,
  cost: 2.4,
  noKnock: true,
  max: 2,
  orient: 'none',
  init(e) {
    e.cd = 1.2;
  },
  update(e, g, dt) {
    stop(e);
    const t = toPlayer(e, g);
    e.facing = t.a;
    switch (e.st) {
      case 0:
        e.cd -= dt;
        if (e.cd <= 0) {
          setState(e, 1);
          e.data.windup = 1;
        }
        break;
      case 1:
        if (e.t > 0.5) {
          e.data.windup = 0;
          const tgt = leadPlayer(g, 0.6);
          for (let i = 0; i < 3; i++) {
            const a = g.rng.range(0, TAU);
            const off = i === 0 ? 0 : g.rng.range(70, 120);
            lob(g, e, e.x, e.y - 16, tgt.x + Math.cos(a) * off, tgt.y + Math.sin(a) * off, 1.0 + i * 0.18, 56, e.def.dmg, 'shell', 0xff7a2a, 200);
          }
          setState(e, 0);
          e.cd = 3.1;
        }
        break;
    }
  },
};

/** BUFFER: a bell-bot whose aura hastes and hardens every ally inside it. */
export const bellwether: EnemyDef = {
  id: 'bellwether',
  name: 'Bellwether',
  blurb: 'Buffer. Allies inside its ring are faster and tougher — pull fights away or kill it.',
  biome: 3,
  roles: ['support'],
  hp: 52,
  speed: 130,
  radius: 18,
  mass: 1.6,
  contact: 0,
  dmg: 0,
  art: 'bellwether',
  blood: 0xffd27a,
  cost: 2.2,
  max: 1,
  orient: 'flip',
  init(e) {
    e.data.auraR = 240;
    e.data.auraC = 0xffd27a;
  },
  update(e, g, dt) {
    kite(e, g, 230, 380, e.def.speed);
    const R = e.data.auraR;
    for (const o of g.enemies.live) {
      if (!o.active || o === e) continue;
      if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 < R * R) {
        o.haste = Math.max(o.haste, 0.3);
        o.data.dr = 0.25;
        o.data.drT = g.time + 0.3;
      } else if ((o.data.drT ?? 0) < g.time) o.data.dr = 0;
    }
    e.cd -= dt;
    if (e.cd <= 0) {
      e.cd = 2;
      const ev = g.events.push(EV.StatusProc, e.x, e.y);
      ev.color = 0xffd27a;
    }
  },
  onRemove(e, g) {
    for (const o of g.enemies.live) o.data.dr = 0;
  },
};

/** BOUNCER: an invulnerable spinning saw that ricochets off walls, then stops — exposed. */
export const gyrosaw: EnemyDef = {
  id: 'gyrosaw',
  name: 'Gyrosaw',
  blurb: 'Bouncer. Invulnerable while spinning; strike it when it stops and glows.',
  biome: 3,
  roles: ['zone', 'disrupt'],
  hp: 46,
  speed: 0,
  radius: 18,
  mass: 2,
  contact: 0,
  dmg: 11,
  art: 'gyrosaw',
  blood: 0xffe14a,
  cost: 2.3,
  unlock: 1,
  max: 2,
  orient: 'none',
  init(e) {
    e.cd = 0.6;
  },
  update(e, g, dt) {
    const t = toPlayer(e, g);
    switch (e.st) {
      case 0: // exposed / idle
        stop(e);
        e.invuln = false;
        e.visual = 0;
        e.cd -= dt;
        if (e.cd <= 0) {
          setState(e, 1);
          e.a = t.a;
          e.tg = tgLine(g, e, e.a, rayToWall(g, e.x, e.y, e.a, 900, e.r) + e.r, e.r * 2, 0.6);
        }
        break;
      case 1:
        stop(e);
        if (e.t < 0.3) {
          e.a = t.a;
          if (e.tg) {
            e.tg.angle = e.a;
            e.tg.len = rayToWall(g, e.x, e.y, e.a, 900, e.r) + e.r;
          }
        } else if (e.tg) e.tg.locked = true;
        if (e.t >= 0.6) {
          g.clearTelegraphs(e);
          setState(e, 2);
          e.invuln = true;
          e.visual = 3;
          e.n = 3;
          e.tx = Math.cos(e.a) * 620;
          e.ty = Math.sin(e.a) * 620;
          e.c = 0;
        }
        break;
      case 2: {
        // spinning: bounce off walls
        e.vx = e.tx;
        e.vy = e.ty;
        const A = g.arena;
        if ((e.x <= A.x0 + e.r + 1 && e.tx < 0) || (e.x >= A.x1 - e.r - 1 && e.tx > 0)) {
          e.tx = -e.tx;
          e.n--;
          const ev = g.events.push(EV.Slam, e.x, e.y);
          ev.color = 0xffe14a;
          ev.power = 0.4;
        }
        if ((e.y <= A.y0 + e.r + 1 && e.ty < 0) || (e.y >= A.y1 - e.r - 1 && e.ty > 0)) {
          e.ty = -e.ty;
          e.n--;
          const ev = g.events.push(EV.Slam, e.x, e.y);
          ev.color = 0xffe14a;
          ev.power = 0.4;
        }
        e.c -= dt;
        if (e.c <= 0 && playerNear(e, g, e.r)) {
          if (g.hurtPlayer(e.def.dmg * e.dmgMul, e.x, e.y, e)) e.c = 0.5;
        }
        if (e.n <= 0 || e.t > 4) {
          stop(e);
          e.invuln = false;
          e.visual = 0;
          setState(e, 0);
          e.cd = 2.1;
          e.data.vuln = 0.6;
          e.data.vulnT = g.time + 2.1;
        }
        break;
      }
    }
  },
};

/** TRAIL LAYER: a beetle that circles you, leaving burning slag that cages you in. */
export const slagcrawler: EnemyDef = {
  id: 'slagcrawler',
  name: 'Slagcrawler',
  blurb: 'Trail layer. Circles you laying molten slag — cut through and kill it.',
  biome: 3,
  roles: ['zone', 'front'],
  hp: 56,
  speed: 205,
  radius: 18,
  mass: 1.6,
  contact: 0,
  dmg: 5,
  art: 'slagcrawler',
  blood: 0xff6a2a,
  cost: 2.2,
  max: 2,
  orient: 'flip',
  init(e, g) {
    e.b = g.rng.sign();
    e.a = Math.atan2(e.y - g.player.y, e.x - g.player.x);
  },
  update(e, g, dt) {
    const p = g.player;
    e.a += e.b * dt * 1.0;
    const r = 215 + Math.sin(g.time * 0.8 + e.id) * 40;
    moveTo(e, g, p.x + Math.cos(e.a) * r, p.y + Math.sin(e.a) * r, e.def.speed);
    e.facing = Math.atan2(e.vy, e.vx);
    e.cd -= dt;
    if (e.cd <= 0) {
      e.cd = 0.22;
      const h = addHazard(g, HZ.Slag, TEAM_ENEMY, e.x, e.y, 24, 3.6, e.def.dmg, 0xff6a2a, e);
      h.armT = 0.25;
    }
    if (g.rng.next() < dt * 0.12) e.b = -e.b;
  },
};

/** LATCHING SWARM: mites that cling to you and slow you down. Dash to shake them off. */
export const sparkmite: EnemyDef = {
  id: 'sparkmite',
  name: 'Sparkmite',
  blurb: 'Latching swarm. Each clinging mite slows you — dash to shake them off.',
  biome: 3,
  roles: ['swarm'],
  hp: 7,
  speed: 300,
  radius: 9,
  mass: 0.3,
  contact: 0,
  dmg: 3,
  art: 'sparkmite',
  blood: 0x7fe3ff,
  cost: 0.45,
  group: 6,
  unlock: 1,
  noElite: true,
  orient: 'flip',
  update(e, g, dt) {
    const p = g.player;
    if (e.latched) {
      if (p.dashing || p.dead) {
        // shaken off
        e.latched = false;
        e.flying = false;
        e.stun = 0.9;
        const a = e.a;
        e.kx = Math.cos(a) * 520;
        e.ky = Math.sin(a) * 520;
        const ev = g.events.push(EV.Deflect, e.x, e.y);
        ev.color = 0x7fe3ff;
        return;
      }
      e.a += dt * 3;
      e.x = p.x + Math.cos(e.a) * (p.r + 4);
      e.y = p.y + Math.sin(e.a) * (p.r + 4) - 6;
      e.vx = e.vy = 0;
      p.latchSlow += 0.11;
      e.cd -= dt;
      if (e.cd <= 0) {
        e.cd = 1;
        g.hurtPlayer(e.def.dmg * e.dmgMul, e.x, e.y, e);
      }
      return;
    }
    const t = toPlayer(e, g);
    moveTo(e, g, p.x, p.y, e.def.speed);
    e.facing = t.a;
    if (t.d < p.r + e.r && !p.dashing && p.hurtT <= 0) {
      e.latched = true;
      e.flying = true;
      e.a = Math.atan2(e.y - p.y, e.x - p.x);
      e.cd = 0.6;
    }
  },
};

export const BIOME3: EnemyDef[] = [rivethound, coilsentry, ironclad, forgemortar, bellwether, gyrosaw, slagcrawler, sparkmite];
export const SUMMONS3: EnemyDef[] = [pylon];
export const _unused3 = (g: Game, e: Enemy) => [g, e];
