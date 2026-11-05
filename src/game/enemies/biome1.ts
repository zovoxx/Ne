import type { EnemyDef } from './types';
import { faceTo, kite, leadPlayer, moveTo, playerInArc, playerNear, rayToWall, setState, stop, tgCircle, tgCone, tgLine, toPlayer } from './ai';
import { explode } from '../combat';
import { lob } from '../projectiles';
import { EV } from '../events';
import { DEG, TAU } from '../math';

/* ═══════════════════════ BIOME 1 — THE ASHEN GARDENS ═══════════════════════ */

/** RUSHER: sprints at you, telegraphs a short bite-lunge. Teaches spacing + dash timing. */
export const cinderling: EnemyDef = {
  id: 'cinderling',
  name: 'Cinderling',
  blurb: 'Rusher. Sprints in and lunges — dash through the lunge.',
  biome: 1,
  roles: ['front', 'swarm'],
  hp: 26,
  speed: 215,
  radius: 15,
  mass: 1,
  contact: 0,
  dmg: 7,
  art: 'cinderling',
  blood: 0xff8a3d,
  cost: 1,
  orient: 'flip',
  update(e, g, dt) {
    const t = toPlayer(e, g);
    switch (e.st) {
      case 0: // chase
        e.cd -= dt;
        moveTo(e, g, g.player.x, g.player.y, e.def.speed * (t.d > 260 ? 1.25 : 1));
        faceTo(e, t.a, 12, dt);
        if (t.d < 92 && e.cd <= 0) {
          setState(e, 1);
          stop(e);
          e.a = t.a;
          e.tg = tgLine(g, e, e.a, 110, 30, 0.32);
        }
        break;
      case 1: // windup: tracks briefly, then locks
        stop(e);
        if (e.t < 0.18) {
          e.a = t.a;
          e.facing = t.a;
        } else if (e.tg) e.tg.locked = true;
        if (e.tg) {
          e.tg.x = e.x;
          e.tg.y = e.y;
          e.tg.angle = e.a;
        }
        if (e.t >= 0.32) {
          if (e.tg) e.tg.active = false;
          e.tg = null;
          setState(e, 2);
          e.superArmor = true;
          e.b = 0;
        }
        break;
      case 2: // lunge
        e.vx = Math.cos(e.a) * 560;
        e.vy = Math.sin(e.a) * 560;
        if (!e.b && playerNear(e, g, e.r + 4)) {
          if (g.hurtPlayer(e.def.dmg * e.dmgMul, e.x, e.y, e)) e.b = 1;
        }
        if (e.t >= 0.17) {
          e.superArmor = false;
          setState(e, 3);
        }
        break;
      case 3: // recover (punish window)
        e.vx *= 0.82;
        e.vy *= 0.82;
        if (e.t >= 0.42) {
          setState(e, 0);
          e.cd = 0.5;
        }
        break;
      default:
        setState(e, 0);
    }
  },
};

/** CHARGER: stops, shows a long line, then charges along it. Hitting a wall stuns it (+50% damage). */
export const bramblehorn: EnemyDef = {
  id: 'bramblehorn',
  name: 'Bramblehorn',
  blurb: 'Charger. Telegraphs a line then charges; stunned if it hits a wall.',
  biome: 1,
  roles: ['front', 'disrupt'],
  hp: 70,
  speed: 120,
  radius: 22,
  mass: 2.2,
  contact: 0,
  dmg: 12,
  art: 'bramblehorn',
  blood: 0xc9873a,
  cost: 2.5,
  orient: 'flip',
  init(e) {
    e.data.vuln = 0.5;
  },
  update(e, g, dt) {
    const t = toPlayer(e, g);
    switch (e.st) {
      case 0:
        e.cd -= dt;
        if (t.d > 240) moveTo(e, g, g.player.x, g.player.y, e.def.speed);
        else stop(e);
        faceTo(e, t.a, 6, dt);
        if (e.cd <= 0 && t.d < 420) {
          setState(e, 1);
          stop(e);
          e.a = t.a;
          e.b = rayToWall(g, e.x, e.y, e.a, 560, e.r);
          e.tg = tgLine(g, e, e.a, e.b + e.r, e.r * 2 + 8, 0.72);
        }
        break;
      case 1: // windup — tracks for 60% then locks
        stop(e);
        if (e.t < 0.44) {
          e.a = t.a;
          e.facing = t.a;
          e.b = rayToWall(g, e.x, e.y, e.a, 560, e.r);
        } else if (e.tg) e.tg.locked = true;
        if (e.tg) {
          e.tg.x = e.x;
          e.tg.y = e.y;
          e.tg.angle = e.a;
          e.tg.len = e.b + e.r;
        }
        if (e.t >= 0.72) {
          if (e.tg) e.tg.active = false;
          e.tg = null;
          setState(e, 2);
          e.superArmor = true;
          e.c = 0;
          e.d = 0;
          e.tx = e.x;
          e.ty = e.y;
        }
        break;
      case 2: {
        // charge
        e.vx = Math.cos(e.a) * 760;
        e.vy = Math.sin(e.a) * 760;
        if (!e.c && playerNear(e, g, e.r + 2)) {
          if (g.hurtPlayer(e.def.dmg * e.dmgMul, e.x, e.y, e)) e.c = 1;
        }
        const travelled = Math.hypot(e.x - e.tx, e.y - e.ty);
        const blocked = e.t > 0.06 && Math.hypot(e.x - e.px, e.y - e.py) < 760 * dt * 0.35;
        if (blocked || travelled >= e.b - 4) {
          e.superArmor = false;
          stop(e);
          if (blocked || e.b < 555) {
            // slammed into a wall: stunned
            e.stun = 1.15;
            const ev = g.events.push(EV.Slam, e.x + Math.cos(e.a) * e.r, e.y + Math.sin(e.a) * e.r);
            ev.power = 0.8;
            ev.color = e.def.blood;
          }
          setState(e, 3);
        }
        if (e.t > 1.2) setState(e, 3);
        break;
      }
      case 3:
        e.superArmor = false;
        e.vx *= 0.8;
        e.vy *= 0.8;
        if (e.t > 0.5) {
          setState(e, 0);
          e.cd = 1.3;
        }
        break;
      default:
        setState(e, 0);
    }
  },
};

/** LOBBER: rooted flower that lobs seeds at where you'll be; uproots and moves every few volleys. */
export const spitbloom: EnemyDef = {
  id: 'spitbloom',
  name: 'Spitbloom',
  blurb: 'Lobber. Arcs seeds at your predicted position; keep moving.',
  biome: 1,
  roles: ['back', 'zone'],
  hp: 38,
  speed: 0,
  radius: 18,
  mass: 3,
  contact: 0,
  dmg: 9,
  art: 'spitbloom',
  blood: 0x7ad9a8,
  cost: 2,
  noKnock: true,
  orient: 'none',
  init(e) {
    e.cd = 0.8;
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
        if (e.t >= 0.35) {
          e.data.windup = 0;
          const tgt = leadPlayer(g, 0.55);
          lob(g, e, e.x, e.y - 10, tgt.x, tgt.y, 0.9, 50, e.def.dmg, 'seed', 0x7ad9a8, 150);
          e.n++;
          e.cd = 2.1;
          setState(e, e.n % 3 === 0 ? 2 : 0);
        }
        break;
      case 2: // uproot and replant elsewhere
        e.visual = 2;
        e.untargetable = e.t > 0.2;
        if (e.t > 0.6) {
          const pt = g.freePointNear(g.player.x, g.player.y, 260, 420, e.r);
          e.x = pt.x;
          e.y = pt.y;
          const ev = g.events.push(EV.Burrow, e.x, e.y);
          ev.color = 0x5a4a3a;
          setState(e, 3);
        }
        break;
      case 3:
        e.untargetable = false;
        e.visual = 0;
        if (e.t > 0.4) setState(e, 0);
        break;
    }
  },
  onHit(e) {
    return e.st === 2 && e.untargetable;
  },
};

/** SWARM: little flames that orbit you, then dart through one at a time. */
export const ashwisp: EnemyDef = {
  id: 'ashwisp',
  name: 'Ashwisp',
  blurb: 'Swarm. Orbits you, then darts in — kill them mid-orbit.',
  biome: 1,
  roles: ['swarm'],
  hp: 10,
  speed: 240,
  radius: 11,
  mass: 0.5,
  contact: 0,
  dmg: 5,
  art: 'ashwisp',
  blood: 0xffd166,
  cost: 0.6,
  group: 5,
  flying: true,
  orient: 'none',
  init(e, g) {
    e.a = g.rng.range(0, TAU);
    e.b = g.rng.chance(0.5) ? 1 : -1;
    e.cd = g.rng.range(1, 3);
  },
  update(e, g, dt) {
    const p = g.player;
    const t = toPlayer(e, g);
    switch (e.st) {
      case 0: {
        e.a += e.b * dt * 1.6;
        const r = 150 + Math.sin(g.time * 2 + e.id) * 25;
        moveTo(e, g, p.x + Math.cos(e.a) * r, p.y + Math.sin(e.a) * r, e.def.speed);
        e.cd -= dt;
        if (e.cd <= 0 && t.d < 260) {
          setState(e, 1);
          e.data.windup = 1;
        }
        break;
      }
      case 1:
        e.vx *= 0.85;
        e.vy *= 0.85;
        if (e.t > 0.38) {
          e.data.windup = 0;
          e.c = t.a;
          setState(e, 2);
          e.d = 0;
        }
        break;
      case 2:
        e.vx = Math.cos(e.c) * 640;
        e.vy = Math.sin(e.c) * 640;
        if (!e.d && playerNear(e, g, e.r)) {
          if (g.hurtPlayer(e.def.dmg * e.dmgMul, e.x, e.y, e)) e.d = 1;
        }
        if (e.t > 0.42) {
          setState(e, 0);
          e.a = Math.atan2(e.y - p.y, e.x - p.x);
          e.cd = g.rng.range(1.6, 3.2);
        }
        break;
    }
  },
};

/** BURROWER: tunnels under you (untargetable), shows a circle, erupts, then is exposed. */
export const burrowmaw: EnemyDef = {
  id: 'burrowmaw',
  name: 'Burrowmaw',
  blurb: 'Burrower. Hunts you underground — move off the circle, punish when it surfaces.',
  biome: 1,
  roles: ['disrupt', 'front'],
  hp: 54,
  speed: 250,
  radius: 20,
  mass: 2,
  contact: 0,
  dmg: 11,
  art: 'burrowmaw',
  blood: 0xd9846a,
  cost: 2.2,
  unlock: 1,
  orient: 'none',
  init(e) {
    e.st = 1;
    e.untargetable = true;
    e.visual = 1;
  },
  update(e, g, dt) {
    const t = toPlayer(e, g);
    switch (e.st) {
      case 0: // surfaced, idle a moment
        e.untargetable = false;
        e.visual = 0;
        stop(e);
        if (e.t > 0.3) {
          setState(e, 1);
          const ev = g.events.push(EV.Burrow, e.x, e.y);
          ev.color = 0x6a4a3a;
        }
        break;
      case 1: // underground chase
        e.untargetable = true;
        e.visual = 1;
        moveTo(e, g, g.player.x, g.player.y, e.def.speed);
        if (g.rng.next() < 0.25) {
          const ev = g.events.push(EV.Burrow, e.x, e.y);
          ev.color = 0x5a3a2a;
        }
        if (t.d < 24 || e.t > 2.2) {
          stop(e);
          setState(e, 2);
          e.tg = tgCircle(g, e, e.x, e.y, 64, 0.62);
        }
        break;
      case 2: // telegraph
        stop(e);
        if (e.t >= 0.62) {
          if (e.tg) e.tg.active = false;
          e.tg = null;
          e.untargetable = false;
          e.visual = 0;
          explode(g, e.x, e.y, 64, e.def.dmg * e.dmgMul, 1, 0.6, 'other', e);
          setState(e, 3);
        }
        break;
      case 3: // exposed
        stop(e);
        e.facing = t.a;
        if (e.t > 1.7) setState(e, 0);
        break;
    }
  },
};

/** EXPLODER: waddles in and lights its fuse. Killing it during the fuse blasts its friends instead. */
export const kindlepod: EnemyDef = {
  id: 'kindlepod',
  name: 'Kindlepod',
  blurb: 'Exploder. Lights its fuse near you; kill it mid-fuse to blow up its friends.',
  biome: 1,
  roles: ['front', 'swarm'],
  hp: 24,
  speed: 145,
  radius: 16,
  mass: 1,
  contact: 0,
  dmg: 16,
  art: 'kindlepod',
  blood: 0xffb347,
  cost: 1.4,
  orient: 'flip',
  update(e, g, dt) {
    const t = toPlayer(e, g);
    switch (e.st) {
      case 0:
        moveTo(e, g, g.player.x, g.player.y, e.def.speed);
        e.facing = t.a;
        if (t.d < 96) {
          setState(e, 1);
          stop(e);
          e.superArmor = true;
          e.tg = tgCircle(g, e, e.x, e.y, 92, 0.85, 0xff6a2a);
        }
        break;
      case 1:
        stop(e);
        if (e.tg) {
          e.tg.x = e.x;
          e.tg.y = e.y;
        }
        if (e.t >= 0.85) {
          g.clearTelegraphs(e);
          explode(g, e.x, e.y, 92, e.def.dmg * e.dmgMul, 2, 0.8, 'other', e);
          e.data.blown = 1;
          g.removeEnemy(e);
          g.room?.onEnemyKilled(g, e);
        }
        break;
    }
  },
  onDeath(e, g) {
    if (e.data.blown) return;
    // killed: the pod bursts outward, hurting only its allies
    explode(g, e.x, e.y, e.st === 1 ? 110 : 70, 22, 0, 0.6, 'other', e);
  },
};

/** SHIELDER: frontal bark shield blocks everything from the front. Flank it or dash behind. */
export const thornwarden: EnemyDef = {
  id: 'thornwarden',
  name: 'Thorn Warden',
  blurb: 'Shielder. Blocks frontal hits and turns slowly — get behind it.',
  biome: 1,
  roles: ['tank', 'front'],
  hp: 78,
  speed: 80,
  radius: 22,
  mass: 3,
  contact: 0,
  dmg: 12,
  art: 'thornwarden',
  blood: 0x9ccf6a,
  cost: 2.6,
  frontShield: 150 * DEG,
  orient: 'flip',
  update(e, g, dt) {
    const t = toPlayer(e, g);
    switch (e.st) {
      case 0:
        faceTo(e, t.a, 1.7, dt);
        if (t.d > 80) moveTo(e, g, g.player.x, g.player.y, e.def.speed);
        else stop(e);
        e.cd -= dt;
        if (e.cd <= 0 && t.d < 120) {
          setState(e, 1);
          stop(e);
          e.tg = tgCone(g, e, e.facing, 118, 100 * DEG, 0.62);
        }
        break;
      case 1:
        stop(e);
        if (e.tg) {
          e.tg.x = e.x;
          e.tg.y = e.y;
          e.tg.angle = e.facing;
        }
        if (e.t >= 0.62) {
          g.clearTelegraphs(e);
          if (playerInArc(e, g, 118, 100 * DEG)) g.hurtPlayer(e.def.dmg * e.dmgMul, e.x, e.y, e);
          const ev = g.events.push(EV.Slam, e.x + Math.cos(e.facing) * 50, e.y + Math.sin(e.facing) * 50);
          ev.power = 0.5;
          ev.color = 0x9ccf6a;
          e.vx = Math.cos(e.facing) * 240;
          e.vy = Math.sin(e.facing) * 240;
          setState(e, 2);
        }
        break;
      case 2:
        e.vx *= 0.8;
        e.vy *= 0.8;
        if (e.t > 0.55) {
          setState(e, 0);
          e.cd = 1.1;
        }
        break;
    }
  },
};

/** SUMMONER: bloated sac that keeps away and births grubs. Kill it first or drown in grubs. */
export const grubmother: EnemyDef = {
  id: 'grubmother',
  name: 'Grubmother',
  blurb: 'Summoner. Keeps its distance and births grubs — rush it down.',
  biome: 1,
  roles: ['support'],
  hp: 58,
  speed: 95,
  radius: 22,
  mass: 2.5,
  contact: 0,
  dmg: 0,
  art: 'grubmother',
  blood: 0xc96b3a,
  cost: 2.4,
  unlock: 1,
  max: 2,
  orient: 'flip',
  init(e) {
    e.cd = 1.2;
  },
  update(e, g, dt) {
    switch (e.st) {
      case 0:
        kite(e, g, 240, 420, e.def.speed);
        e.cd -= dt;
        if (e.cd <= 0 && e.children < 6) {
          setState(e, 1);
          stop(e);
          e.data.windup = 1;
          e.tg = tgCircle(g, e, e.x, e.y, 46, 0.6, 0xffa060);
        }
        break;
      case 1:
        stop(e);
        if (e.t >= 0.6) {
          g.clearTelegraphs(e);
          e.data.windup = 0;
          const n = 3;
          for (let i = 0; i < n && e.children < 6; i++) {
            const a = (i / n) * TAU + g.rng.range(0, 1);
            const c = g.spawnEnemy(grub, e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, { summoned: true, parent: e });
            c.kx = Math.cos(a) * 260;
            c.ky = Math.sin(a) * 260;
            e.children++;
          }
          e.cd = 3.8;
          setState(e, 0);
        }
        break;
    }
  },
  onRemove(e, g) {
    // orphaned grubs keep going (they're cheap) but stop counting as children
    for (const c of g.enemies.live) if (c.parent === e) c.parent = null;
  },
};

export const grub: EnemyDef = {
  id: 'grub',
  name: 'Grub',
  blurb: 'Summon. Tiny and fast.',
  biome: 1,
  roles: ['swarm'],
  hp: 8,
  speed: 235,
  radius: 10,
  mass: 0.4,
  contact: 4,
  dmg: 4,
  art: 'grub',
  blood: 0xc96b3a,
  cost: 0.3,
  noElite: true,
  orient: 'flip',
  update(e, g, dt) {
    const t = toPlayer(e, g);
    const wob = Math.sin(g.time * 9 + e.id) * 0.6;
    moveTo(e, g, g.player.x + Math.cos(t.a + 1.57) * wob * 30, g.player.y + Math.sin(t.a + 1.57) * wob * 30, e.def.speed);
    e.facing = t.a;
    void dt;
  },
  onRemove(e) {
    if (e.parent && e.parent.active) e.parent.children = Math.max(0, e.parent.children - 1);
  },
};

export const BIOME1: EnemyDef[] = [cinderling, bramblehorn, spitbloom, ashwisp, burrowmaw, kindlepod, thornwarden, grubmother];
export const SUMMONS1: EnemyDef[] = [grub];

