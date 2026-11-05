import type { EnemyDef } from './types';
import { kite, moveTo, playerInArc, playerNear, playerOnLine, setState, stop, tgCircle, tgCone, tgLine, toPlayer } from './ai';
import { fireEnemy, PJ } from '../projectiles';
import { addHazard } from '../hazards';
import { explode } from '../combat';
import { EV } from '../events';
import { clamp, DEG, TAU } from '../math';
import { Enemy, HZ, TEAM_ENEMY, type Telegraph } from '../entities';
import type { Game } from '../game';

/* ═══════════════════════ BIOME 4 — THE STARLESS CROWN ═══════════════════════ */

function blink(g: Game, e: Enemy, x: number, y: number) {
  const a = g.events.push(EV.Teleport, e.x, e.y);
  a.color = 0xd45cff;
  e.x = e.px = x;
  e.y = e.py = y;
  const b = g.events.push(EV.Teleport, x, y);
  b.color = 0xd45cff;
}

/** SUMMONER: opens void portals that keep spitting imps. Destroy the portals. */
export const voidcaller: EnemyDef = {
  id: 'voidcaller',
  name: 'Voidcaller',
  blurb: 'Summoner. Opens portals that spawn imps — break the portals or the caller.',
  biome: 4,
  roles: ['support'],
  hp: 52,
  speed: 140,
  radius: 18,
  mass: 1.4,
  contact: 0,
  dmg: 0,
  art: 'voidcaller',
  blood: 0xd45cff,
  cost: 2.6,
  max: 1,
  orient: 'flip',
  init(e) {
    e.cd = 0.8;
  },
  update(e, g, dt) {
    const t = toPlayer(e, g);
    e.cd2 -= dt;
    switch (e.st) {
      case 0:
        kite(e, g, 300, 460, e.def.speed);
        e.facing = t.a;
        if (t.d < 150 && e.cd2 <= 0) {
          const pt = g.freePointNear(g.player.x, g.player.y, 340, 460, e.r);
          blink(g, e, pt.x, pt.y);
          e.cd2 = 4;
        }
        e.cd -= dt;
        if (e.cd <= 0 && e.children < 2) {
          setState(e, 1);
          stop(e);
          const pt = g.freePointNear(e.x, e.y, 110, 200, 24);
          e.tx = pt.x;
          e.ty = pt.y;
          e.tg = tgCircle(g, e, e.tx, e.ty, 30, 0.6, 0xd45cff);
          e.data.windup = 1;
        }
        break;
      case 1:
        stop(e);
        if (e.t >= 0.6) {
          g.clearTelegraphs(e);
          e.data.windup = 0;
          g.spawnEnemy(voidportal, e.tx, e.ty, { summoned: true, parent: e });
          e.children++;
          setState(e, 0);
          e.cd = 5;
        }
        break;
    }
  },
};

export const voidportal: EnemyDef = {
  id: 'voidportal',
  name: 'Void Portal',
  blurb: 'Summon. Spawns imps until destroyed.',
  biome: 4,
  roles: ['support'],
  hp: 34,
  speed: 0,
  radius: 20,
  mass: 9,
  contact: 0,
  dmg: 0,
  art: 'voidportal',
  blood: 0xd45cff,
  cost: 0,
  noKnock: true,
  noElite: true,
  orient: 'none',
  init(e) {
    e.cd = 0.6;
  },
  update(e, g, dt) {
    stop(e);
    e.cd -= dt;
    if (e.cd <= 0 && e.children < 3) {
      const a = g.rng.range(0, TAU);
      const c = g.spawnEnemy(voidimp, e.x + Math.cos(a) * 26, e.y + Math.sin(a) * 26, { summoned: true, parent: e, portal: false });
      c.kx = Math.cos(a) * 300;
      c.ky = Math.sin(a) * 300;
      e.children++;
      e.cd = 2.3;
    }
  },
  onRemove(e) {
    if (e.parent && e.parent.active) e.parent.children = Math.max(0, e.parent.children - 1);
  },
};

export const voidimp: EnemyDef = {
  id: 'voidimp',
  name: 'Void Imp',
  blurb: 'Summon. Fast claw rusher.',
  biome: 4,
  roles: ['swarm'],
  hp: 14,
  speed: 250,
  radius: 12,
  mass: 0.6,
  contact: 5,
  dmg: 5,
  art: 'voidimp',
  blood: 0xd45cff,
  cost: 0.4,
  noElite: true,
  orient: 'flip',
  update(e, g) {
    const t = toPlayer(e, g);
    moveTo(e, g, g.player.x, g.player.y, e.def.speed);
    e.facing = t.a;
  },
  onRemove(e) {
    if (e.parent && e.parent.active) e.parent.children = Math.max(0, e.parent.children - 1);
  },
};

/** PARRY KNIGHT: raises a mirror guard — hitting it then triggers a counter and reflects shots. */
export const mirrorknight: EnemyDef = {
  id: 'mirrorknight',
  name: 'Mirror Knight',
  blurb: 'Parrier. Don’t hit it while its mirror glows — wait, then punish its combo.',
  biome: 4,
  roles: ['tank', 'front'],
  hp: 72,
  speed: 130,
  radius: 20,
  mass: 2.2,
  contact: 0,
  dmg: 13,
  art: 'mirrorknight',
  blood: 0xe8d8ff,
  cost: 2.8,
  max: 2,
  orient: 'flip',
  init(e) {
    e.cd = 0.6;
  },
  update(e, g, dt) {
    const t = toPlayer(e, g);
    switch (e.st) {
      case 0:
        moveTo(e, g, g.player.x, g.player.y, e.def.speed);
        e.facing = t.a;
        e.cd -= dt;
        if (e.cd <= 0 && t.d < 220) {
          setState(e, 1);
          e.parry = true;
          e.superArmor = true;
        }
        break;
      case 1: // guard stance
        stop(e);
        e.facing = t.a;
        if (e.t > 1.3) {
          e.parry = false;
          setState(e, 2);
          e.n = 0;
          e.tg = tgCone(g, e, t.a, 104, 120 * DEG, 0.36);
        }
        break;
      case 2: // two-hit combo
        e.superArmor = true;
        if (e.tg) {
          e.tg.x = e.x;
          e.tg.y = e.y;
        }
        if (e.t < 0.2) moveTo(e, g, g.player.x, g.player.y, 120);
        else stop(e);
        if (e.t >= 0.36) {
          const ang = e.tg ? e.tg.angle : t.a;
          g.clearTelegraphs(e);
          if (playerInArc(e, g, 104, 120 * DEG, ang)) g.hurtPlayer(e.def.dmg * e.dmgMul, e.x, e.y, e);
          const ev = g.events.push(EV.Slam, e.x + Math.cos(ang) * 50, e.y + Math.sin(ang) * 50);
          ev.color = 0xe8d8ff;
          ev.power = 0.4;
          e.n++;
          if (e.n < 2) {
            e.t = 0;
            e.tg = tgCone(g, e, t.a, 104, 120 * DEG, 0.3);
          } else {
            e.superArmor = false;
            setState(e, 4);
          }
        }
        break;
      case 3: // riposte after a parried hit
        stop(e);
        if (!e.tg) e.tg = tgCone(g, e, t.a, 112, 150 * DEG, 0.22);
        if (e.t >= 0.22) {
          const ang = e.tg ? e.tg.angle : t.a;
          g.clearTelegraphs(e);
          if (playerInArc(e, g, 112, 150 * DEG, ang)) g.hurtPlayer(e.def.dmg * e.dmgMul * 1.2, e.x, e.y, e);
          e.parry = false;
          e.superArmor = false;
          setState(e, 4);
        }
        break;
      case 4: // exposed recovery
        stop(e);
        if (e.t > 0.9) {
          setState(e, 0);
          e.cd = 1.4;
        }
        break;
    }
  },
  onHit(e, g, info) {
    if (e.parry && !info.isDot && e.st === 1) {
      const ev = g.events.push(EV.Block, e.x, e.y);
      ev.dx = -info.dirX;
      ev.dy = -info.dirY;
      ev.power = 0.6;
      setState(e, 3);
      return true;
    }
    return false;
  },
};

/** PULLER: opens a gravity well under you that drags you toward its crushing core. */
export const gravewell: EnemyDef = {
  id: 'gravewell',
  name: 'Gravewell Seer',
  blurb: 'Puller. Its well drags you toward a crushing core — dash out of the pull.',
  biome: 4,
  roles: ['zone', 'disrupt'],
  hp: 46,
  speed: 120,
  radius: 18,
  mass: 1.4,
  contact: 0,
  dmg: 10,
  art: 'gravewell',
  blood: 0x9a6cff,
  cost: 2.4,
  flying: true,
  max: 2,
  orient: 'none',
  init(e) {
    e.cd = 1.2;
  },
  update(e, g, dt) {
    const p = g.player;
    switch (e.st) {
      case 0:
        kite(e, g, 280, 440, e.def.speed);
        e.cd -= dt;
        if (e.cd <= 0) {
          setState(e, 1);
          stop(e);
          e.tx = p.x;
          e.ty = p.y;
          e.tg = tgCircle(g, e, e.tx, e.ty, 50, 0.8, 0x9a6cff);
          e.data.windup = 1;
        }
        break;
      case 1:
        stop(e);
        if (e.t >= 0.8) {
          g.clearTelegraphs(e);
          e.data.windup = 0;
          const h = addHazard(g, HZ.Well, TEAM_ENEMY, e.tx, e.ty, 50, 2.6, e.def.dmg, 0x9a6cff, e);
          h.b = 210;
          setState(e, 0);
          e.cd = 4.8;
        }
        break;
    }
  },
};

/** SWEEPER: a crystal that charges, then fires a beam that sweeps across the room. */
export const prism: EnemyDef = {
  id: 'prism',
  name: 'Prism',
  blurb: 'Sweeper. Its beam rotates through the shaded arc — get behind the crystal or out of the arc.',
  biome: 4,
  roles: ['back', 'zone'],
  hp: 52,
  speed: 0,
  radius: 18,
  mass: 6,
  contact: 0,
  dmg: 12,
  art: 'prism',
  blood: 0xffb3ff,
  cost: 2.6,
  noKnock: true,
  max: 2,
  orient: 'none',
  init(e) {
    e.cd = 1;
  },
  update(e, g, dt) {
    stop(e);
    const t = toPlayer(e, g);
    switch (e.st) {
      case 0:
        e.cd -= dt;
        if (e.cd <= 0) {
          setState(e, 1);
          e.b = g.rng.sign();
          const sweep = 120 * DEG;
          e.a = t.a - (e.b * sweep) / 2;
          e.tg = tgCone(g, e, t.a, 520, sweep, 0.9, 0xff5ad8);
          e.tg2 = tgLine(g, e, e.a, 520, 16, 0.9, 0xff5ad8);
          e.data.windup = 1;
        }
        break;
      case 1:
        if (e.t >= 0.9) {
          g.clearTelegraphs(e);
          e.data.windup = 0;
          const h = addHazard(g, HZ.Beam, TEAM_ENEMY, e.x, e.y, 520, 1.5, e.def.dmg, 0xff5ad8, e);
          h.angle = e.a;
          h.a = (e.b * 120 * DEG) / 1.5;
          h.w = 18;
          setState(e, 2);
        }
        break;
      case 2:
        if (e.t > 1.6) {
          setState(e, 0);
          e.cd = 2.6;
        }
        break;
    }
  },
};

/** MULTI-DASH: plans three dashes at once (all shown), then executes them in a blur. */
export const wraithlancer: EnemyDef = {
  id: 'wraithlancer',
  name: 'Wraith Lancer',
  blurb: 'Multi-dash. Shows three lines, then dashes along each in order — read the path.',
  biome: 4,
  roles: ['front', 'disrupt'],
  hp: 56,
  speed: 150,
  radius: 18,
  mass: 1.6,
  contact: 0,
  dmg: 11,
  art: 'wraithlancer',
  blood: 0xc89cff,
  cost: 2.6,
  unlock: 1,
  flying: true,
  max: 2,
  orient: 'flip',
  init(e) {
    e.cd = 1.2;
  },
  update(e, g, dt) {
    const p = g.player;
    const t = toPlayer(e, g);
    switch (e.st) {
      case 0:
        kite(e, g, 200, 330, e.def.speed);
        e.facing = t.a;
        e.cd -= dt;
        if (e.cd <= 0) {
          setState(e, 1);
          stop(e);
          // plan a 3-segment zig-zag through the player's area
          const A = g.arena;
          let x = e.x;
          let y = e.y;
          const segs: number[] = [];
          for (let i = 0; i < 3; i++) {
            const aim = i === 0 ? Math.atan2(p.y - y, p.x - x) : Math.atan2(p.y - y, p.x - x) + g.rng.range(-0.9, 0.9);
            const len = i === 0 ? Math.hypot(p.x - x, p.y - y) + 80 : g.rng.range(220, 320);
            const nx = clamp(x + Math.cos(aim) * len, A.x0 + 30, A.x1 - 30);
            const ny = clamp(y + Math.sin(aim) * len, A.y0 + 30, A.y1 - 30);
            segs.push(x, y, nx, ny);
            x = nx;
            y = ny;
          }
          e.data.s0 = segs[0];
          for (let i = 0; i < 12; i++) e.data['s' + i] = segs[i];
          const tgs: Telegraph[] = [];
          for (let i = 0; i < 3; i++) {
            const sx = segs[i * 4];
            const sy = segs[i * 4 + 1];
            const ex = segs[i * 4 + 2];
            const ey = segs[i * 4 + 3];
            const tl = g.telegraph(1, sx, sy, 0.85 + i * 0.18, e);
            tl.angle = Math.atan2(ey - sy, ex - sx);
            tl.len = Math.hypot(ex - sx, ey - sy);
            tl.width = 30;
            tl.color = i === 0 ? 0xff3b4a : i === 1 ? 0xff7a3a : 0xffb347;
            tgs.push(tl);
          }
          e.n = 0;
          e.superArmor = true;
        }
        break;
      case 1: // read time
        stop(e);
        if (e.t >= 0.85) {
          setState(e, 2);
          e.n = 0;
          e.b = 0;
        }
        break;
      case 2: {
        // execute segments
        const i = e.n;
        const sx = e.data['s' + i * 4];
        const sy = e.data['s' + (i * 4 + 1)];
        const ex = e.data['s' + (i * 4 + 2)];
        const ey = e.data['s' + (i * 4 + 3)];
        const dur = 0.17;
        const k = Math.min(1, e.t / dur);
        e.x = sx + (ex - sx) * k;
        e.y = sy + (ey - sy) * k;
        e.vx = e.vy = 0;
        e.facing = Math.atan2(ey - sy, ex - sx);
        if (!(e.b & (1 << i)) && playerOnLine(g, sx, sy, Math.atan2(ey - sy, ex - sx), Math.hypot(ex - sx, ey - sy) * k, 30) && playerNear(e, g, 60)) {
          if (g.hurtPlayer(e.def.dmg * e.dmgMul, e.x, e.y, e)) e.b |= 1 << i;
        }
        if (k >= 1) {
          // retire this segment's telegraph
          for (const tl of g.telegraphs.live) if (tl.owner === e && tl.active && Math.abs(tl.x - sx) < 1 && Math.abs(tl.y - sy) < 1) tl.active = false;
          e.n++;
          e.t = 0;
          if (e.n >= 3) {
            g.clearTelegraphs(e);
            e.superArmor = false;
            setState(e, 3);
          }
        }
        break;
      }
      case 3:
        stop(e);
        if (e.t > 0.8) {
          setState(e, 0);
          e.cd = 3;
        }
        break;
    }
  },
};

/** SHIELD BUFFER: wraps its allies in light bubbles that must be popped first. */
export const aegisherald: EnemyDef = {
  id: 'aegisherald',
  name: 'Aegis Herald',
  blurb: 'Shield buffer. Gives allies bubble shields — pop them or kill the herald.',
  biome: 4,
  roles: ['support'],
  hp: 50,
  speed: 140,
  radius: 18,
  mass: 1.4,
  contact: 0,
  dmg: 0,
  art: 'aegisherald',
  blood: 0xfff1a6,
  cost: 2.4,
  flying: true,
  max: 1,
  orient: 'flip',
  init(e) {
    e.cd = 1.5;
  },
  update(e, g, dt) {
    kite(e, g, 280, 440, e.def.speed);
    e.cd -= dt;
    if (e.st === 0 && e.cd <= 0) {
      setState(e, 1);
      e.data.windup = 1;
    }
    if (e.st === 1 && e.t > 0.5) {
      e.data.windup = 0;
      const cands = g.enemies.live.filter((o) => o.targetable && o !== e && o.bubble <= 0 && !o.isBoss && o.def.id !== 'aegisherald');
      cands.sort((a, b) => (a.x - e.x) ** 2 + (a.y - e.y) ** 2 - ((b.x - e.x) ** 2 + (b.y - e.y) ** 2));
      for (const o of cands.slice(0, 3)) {
        o.bubble = Math.max(18, Math.round(o.maxHp * 0.35));
        const ev = g.events.push(EV.Beam, e.x, e.y);
        ev.dx = o.x;
        ev.dy = o.y;
        ev.color = 0xfff1a6;
      }
      setState(e, 0);
      e.cd = 4.5;
    }
  },
};

/** DELAYED AoE: drops three curse circles on your trail, one after another. Keep moving. */
export const hexer: EnemyDef = {
  id: 'hexer',
  name: 'Hexer',
  blurb: 'Curse layer. Circles follow your path and detonate — never stand still.',
  biome: 4,
  roles: ['back', 'zone'],
  hp: 42,
  speed: 135,
  radius: 16,
  mass: 1,
  contact: 0,
  dmg: 11,
  art: 'hexer',
  blood: 0xb45cff,
  cost: 2,
  orient: 'flip',
  init(e) {
    e.cd = 1;
  },
  update(e, g, dt) {
    const p = g.player;
    const t = toPlayer(e, g);
    switch (e.st) {
      case 0:
        kite(e, g, 260, 420, e.def.speed);
        e.facing = t.a;
        e.cd -= dt;
        if (e.cd <= 0) {
          setState(e, 1);
          e.n = 0;
          e.c = 0;
        }
        break;
      case 1:
        stop(e);
        e.data.windup = 1;
        e.c -= dt;
        if (e.c <= 0 && e.n < 3) {
          const tl = tgCircle(g, e, p.x, p.y, 56, 0.9, 0xb45cff);
          tl.linger = 0.01;
          e.data['hx' + e.n] = p.x;
          e.data['hy' + e.n] = p.y;
          e.data['ht' + e.n] = g.time + 0.9;
          e.n++;
          e.c = 0.42;
        }
        for (let i = 0; i < 3; i++) {
          const tt = e.data['ht' + i];
          if (tt && g.time >= tt) {
            e.data['ht' + i] = 0;
            explode(g, e.data['hx' + i], e.data['hy' + i], 56, e.def.dmg * e.dmgMul, 1, 0.5, 'other', e);
          }
        }
        if (e.n >= 3 && !e.data.ht0 && !e.data.ht1 && !e.data.ht2) {
          e.data.windup = 0;
          setState(e, 0);
          e.cd = 3.4;
        }
        break;
    }
  },
};

/** BULLET RING: a shard that fires rings of light with gaps, then blinks elsewhere. */
export const nullshard: EnemyDef = {
  id: 'nullshard',
  name: 'Null Shard',
  blurb: 'Bullet rings. Slip through the gap in each ring, then chase it down.',
  biome: 4,
  roles: ['back'],
  hp: 40,
  speed: 0,
  radius: 16,
  mass: 1,
  contact: 0,
  dmg: 8,
  art: 'nullshard',
  blood: 0xffb3ff,
  cost: 2,
  unlock: 1,
  flying: true,
  max: 3,
  orient: 'none',
  init(e) {
    e.cd = 1;
  },
  update(e, g, dt) {
    stop(e);
    const t = toPlayer(e, g);
    switch (e.st) {
      case 0:
        e.cd -= dt;
        if (e.cd <= 0) {
          setState(e, 1);
          e.data.windup = 1;
          e.n = 0;
        }
        break;
      case 1:
        if (e.t > 0.5 + e.n * 0.38 && e.n < 2) {
          e.data.windup = 0;
          const count = 14;
          const gap = t.a + Math.PI + g.rng.range(-0.6, 0.6) + e.n * 0.4;
          for (let i = 0; i < count; i++) {
            const a = gap + (i / count) * TAU;
            if (i === 0 || i === 1) continue; // the gap
            fireEnemy(g, e, PJ.Orb, e.x, e.y, a, 210 + e.n * 30, e.def.dmg, 8, 'bullet', 0xff7ae0);
          }
          e.n++;
        }
        if (e.n >= 2 && e.t > 1.4) {
          setState(e, 2);
          e.visual = 2;
        }
        break;
      case 2:
        e.untargetable = e.t > 0.15;
        if (e.t > 0.35) {
          const pt = g.freePointNear(g.player.x, g.player.y, 240, 400, e.r);
          blink(g, e, pt.x, pt.y);
          e.untargetable = false;
          e.visual = 0;
          setState(e, 0);
          e.cd = 1.8;
        }
        break;
    }
  },
};

export const BIOME4: EnemyDef[] = [voidcaller, mirrorknight, gravewell, prism, wraithlancer, aegisherald, hexer, nullshard];
export const SUMMONS4: EnemyDef[] = [voidportal, voidimp];
