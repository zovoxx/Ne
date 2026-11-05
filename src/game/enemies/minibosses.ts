import type { EnemyDef } from './types';
import { TUNING } from '../../config/tuning';
import type { Enemy } from '../entities';
import { HZ, TEAM_ENEMY } from '../entities';
import type { Game } from '../game';
import { bossInit, bossUpdate, blastAt, fan, ring, summon, type BossSpec } from './boss';
import { kite, moveTo, playerInArc, playerNear, rayToWall, tgCircle, tgCone, tgLine, toPlayer } from './ai';
import { addHazard, addPulse } from '../hazards';
import { fireEnemy, lob, PJ } from '../projectiles';
import { explode } from '../combat';
import { EV } from '../events';
import { clamp, DEG, TAU } from '../math';
import { kindlepod } from './biome1';
import { inkshade } from './biome2';
import { voidimp } from './biome4';

const D = (e: Enemy, k: number) => e.def.dmg * e.dmgMul * k * TUNING.scaling.miniDmg;

function mini(def: Omit<EnemyDef, 'update' | 'init' | 'roles' | 'cost' | 'noKnock' | 'staggerImmune' | 'noElite'>, spec: BossSpec, init?: (e: Enemy, g: Game) => void): EnemyDef {
  return {
    ...def,
    roles: ['elite'],
    cost: 0,
    noKnock: true,
    staggerImmune: true,
    noElite: true,
    init(e, g) {
      bossInit(e, g, true);
      init?.(e, g);
    },
    update(e, g, dt) {
      bossUpdate(e, g, dt, spec);
    },
  };
}

/** generic line charge used by several mini-bosses */
function chargeAttack(id: string, weight: number, speed: number, dmgK: number, count = 1, windup = 0.65) {
  return {
    id,
    weight,
    cd: 3,
    start(e: Enemy, g: Game) {
      e.data.n2 = 0;
      startCharge(e, g, windup);
    },
    tick(e: Enemy, g: Game, dt: number, t: number) {
      const local = t - e.data.cs;
      if (local < windup) {
        if (local < windup * 0.6) {
          e.a = toPlayer(e, g).a;
          e.b = rayToWall(g, e.x, e.y, e.a, 800, e.r);
        } else if (e.tg) e.tg.locked = true;
        if (e.tg) {
          e.tg.x = e.x;
          e.tg.y = e.y;
          e.tg.angle = e.a;
          e.tg.len = e.b + e.r;
        }
        e.facing = e.a;
        return false;
      }
      if (e.tg) {
        e.tg.active = false;
        e.tg = null;
      }
      e.vx = Math.cos(e.a) * speed;
      e.vy = Math.sin(e.a) * speed;
      if (!e.c && playerNear(e, g, e.r)) if (g.hurtPlayer(D(e, dmgK), e.x, e.y, e)) e.c = 1;
      if ((local - windup) * speed >= e.b - 6 || local > windup + 1.6) {
        e.vx = e.vy = 0;
        const ev = g.events.push(EV.Slam, e.x, e.y);
        ev.power = 0.8;
        ev.color = e.def.blood;
        e.data.n2 = (e.data.n2 ?? 0) + 1;
        if (e.data.n2 >= count) {
          e.data.n2 = 0;
          return true;
        }
        startCharge(e, g, windup * 0.7, t);
      }
      return false;
    },
  };
}
function startCharge(e: Enemy, g: Game, windup: number, now = 0) {
  e.data.cs = now;
  e.a = toPlayer(e, g).a;
  e.b = rayToWall(g, e.x, e.y, e.a, 800, e.r);
  e.tg = tgLine(g, e, e.a, e.b + e.r, e.r * 2 + 6, windup);
  e.c = 0;
}

/* ───────────── B1: THORNBACK, the Bramble Brute ───────────── */
export const thornback = mini(
  { id: 'mini_thornback', name: 'Thornback', blurb: 'Guardian of the Gardens: triple charges and thorn bursts.', biome: 1, hp: 520, speed: 120, radius: 32, mass: 10, contact: 0, dmg: 12, art: 'mini_thornback', blood: 0xc9873a, orient: 'flip' },
  {
    phases: [0.45],
    idle: 0.8,
    move(e, g) {
      moveTo(e, g, g.player.x, g.player.y, 110);
      e.facing = toPlayer(e, g).a;
    },
    attacks: [
      chargeAttack('charge3', 3, 800, 1.1, 3, 0.6),
      {
        id: 'thornburst',
        weight: 2,
        cd: 3,
        start(e) {
          e.data.windup = 1;
          e.c = 0;
        },
        tick(e, g, dt, t) {
          if (t > 0.5 && e.c === 0) {
            e.c = 1;
            e.data.windup = 0;
            ring(g, e, e.phase ? 20 : 14, 240, D(e, 0.6), g.rng.range(0, 1), -1, 0, 'needle', 0x9ccf6a, PJ.Needle);
          }
          if (e.phase && t > 0.85 && e.c === 1) {
            e.c = 2;
            ring(g, e, 20, 200, D(e, 0.6), g.rng.range(0, 1), -1, 0, 'needle', 0x9ccf6a, PJ.Needle);
          }
          return t > 1.1;
        },
      },
      {
        id: 'stomp',
        weight: 2,
        cd: 3,
        range: [0, 220],
        start(e, g) {
          e.tg = tgCircle(g, e, e.x, e.y, 150, 0.7);
        },
        tick(e, g, dt, t) {
          if (t >= 0.7) {
            explode(g, e.x, e.y, 150, D(e, 1.1), 1, 0.9, 'other', e);
            addPulse(g, e.x, e.y, 340, 0.6, D(e, 0.6), 0xc9873a, e, 24);
            return true;
          }
          return false;
        },
      },
    ],
  },
);

/* ───────────── B1: BLOOM MOTHER ───────────── */
export const bloommother = mini(
  { id: 'mini_bloom', name: 'Bloom Mother', blurb: 'Guardian of the Gardens: seed volleys, vine sweeps and pods.', biome: 1, hp: 480, speed: 60, radius: 34, mass: 12, contact: 0, dmg: 11, art: 'mini_bloom', blood: 0x7ad9a8, orient: 'none' },
  {
    phases: [0.5],
    idle: 0.7,
    move(e, g) {
      kite(e, g, 220, 380, 60);
    },
    attacks: [
      {
        id: 'volley',
        weight: 3,
        cd: 2.5,
        start(e) {
          e.c = 0;
          e.d = 0;
        },
        tick(e, g, dt, t) {
          e.c -= dt;
          const n = e.phase ? 7 : 5;
          if (e.c <= 0 && e.d < n) {
            e.c = 0.12;
            e.d++;
            const p = g.player;
            const off = e.d === 1 ? 0 : g.rng.range(60, 200);
            const a = g.rng.range(0, TAU);
            lob(g, e, e.x, e.y - 20, p.x + Math.cos(a) * off, p.y + Math.sin(a) * off, 0.95, 52, D(e, 0.9), 'seed', 0x7ad9a8, 170);
          }
          return e.d >= n && t > 1;
        },
      },
      {
        id: 'vine',
        weight: 2,
        cd: 4.5,
        start(e, g) {
          e.b = g.rng.sign();
          e.a = toPlayer(e, g).a - e.b * 1.2;
          e.tg = tgLine(g, e, e.a, 420, 22, 0.8, 0x9ccf6a);
          e.c = 0;
        },
        tick(e, g, dt, t) {
          if (t >= 0.8 && !e.c) {
            e.c = 1;
            const h = addHazard(g, HZ.Beam, TEAM_ENEMY, e.x, e.y, 420, 1.8, D(e, 0.8), 0x9ccf6a, e);
            h.angle = e.a;
            h.a = e.b * 2.4;
            h.w = 22;
          }
          return t > 2.7;
        },
      },
      {
        id: 'pods',
        weight: 1.5,
        cd: 7,
        start(e) {
          e.data.windup = 1;
        },
        tick(e, g, dt, t) {
          if (t > 0.6) {
            e.data.windup = 0;
            let alive = 0;
            for (const o of g.enemies.live) if (o.active && o.parent === e) alive++;
            if (alive < 4) summon(g, e, kindlepod, 3, 110);
            return true;
          }
          return false;
        },
      },
      {
        id: 'petals',
        weight: 2,
        cd: 3,
        start(e) {
          e.c = 0;
          e.d = 0;
        },
        tick(e, g, dt, t) {
          e.c -= dt;
          if (e.c <= 0 && e.d < 3) {
            e.c = 0.35;
            e.d++;
            ring(g, e, 12, 200, D(e, 0.5), e.d * 0.26, -1, 0, 'bullet', 0xff9a5a);
          }
          return e.d >= 3 && t > 1.1;
        },
      },
    ],
  },
);

/* ───────────── B2: THE LIBRARIAN ───────────── */
export const librarian = mini(
  { id: 'mini_librarian', name: 'The Librarian', blurb: 'Guardian of the Archive: homing pages, blinks and ink snipes.', biome: 2, hp: 470, speed: 140, radius: 28, mass: 8, contact: 0, dmg: 11, art: 'mini_librarian', blood: 0xffe0a0, orient: 'flip', flying: true },
  {
    phases: [0.5],
    idle: 0.6,
    move(e, g) {
      kite(e, g, 240, 400, 150);
      e.facing = toPlayer(e, g).a;
    },
    attacks: [
      {
        id: 'pages',
        weight: 3,
        cd: 3,
        start(e, g) {
          const n = e.phase ? 8 : 6;
          for (let i = 0; i < n; i++) {
            const pr = fireEnemy(g, e, PJ.Homing, e.x, e.y, (i / n) * TAU, 200, D(e, 0.6), 10, 'page', 0xffe0a0);
            pr.homing = 1.6;
            pr.life = pr.maxLife = 4;
          }
        },
        tick(e, g, dt, t) {
          return t > 0.7;
        },
      },
      {
        id: 'blink',
        weight: 2,
        cd: 3,
        start(e) {
          e.visual = 2;
          e.untargetable = true;
        },
        tick(e, g, dt, t) {
          if (t > 0.4) {
            const pt = g.freePointNear(g.player.x, g.player.y, 260, 380, e.r);
            const ev = g.events.push(EV.Teleport, e.x, e.y);
            ev.color = 0x47d6ff;
            e.x = e.px = pt.x;
            e.y = e.py = pt.y;
            e.visual = 0;
            e.untargetable = false;
            fan(g, e, toPlayer(e, g).a, 5, 50 * DEG, 380, D(e, 0.6), 'needle', 0xbff6ff, PJ.Needle, 6);
            return true;
          }
          return false;
        },
      },
      {
        id: 'snipe',
        weight: 2,
        cd: 3.5,
        start(e, g) {
          const a = toPlayer(e, g).a;
          e.a = a;
          const t1 = tgLine(g, e, a - 0.18, 1000, 8, 1, 0xff3b4a);
          const t2 = tgLine(g, e, a + 0.18, 1000, 8, 1, 0xff3b4a);
          t1.linger = t2.linger = 0.02;
        },
        tick(e, g, dt, t) {
          if (t < 0.7) {
            e.a = toPlayer(e, g).a;
            let k = -1;
            for (const tl of g.telegraphs.live)
              if (tl.owner === e && tl.active) {
                tl.angle = e.a + k * 0.18;
                tl.x = e.x;
                tl.y = e.y;
                k += 2;
              }
          } else for (const tl of g.telegraphs.live) if (tl.owner === e) tl.locked = true;
          if (t >= 1) {
            for (const k of [-1, 1]) {
              const pr = fireEnemy(g, e, PJ.Bolt, e.x, e.y, e.a + k * 0.18, 1200, D(e, 1), 8, 'bolt', 0x7fe3ff);
              pr.pierce = 99;
              pr.reflectable = false;
            }
            return true;
          }
          return false;
        },
      },
      {
        id: 'shades',
        weight: 1.2,
        cd: 8,
        start(e) {
          e.data.windup = 1;
        },
        tick(e, g, dt, t) {
          if (t > 0.5) {
            e.data.windup = 0;
            let alive = 0;
            for (const o of g.enemies.live) if (o.active && o.parent === e) alive++;
            if (alive < 3) summon(g, e, inkshade, 2, 140);
            return true;
          }
          return false;
        },
      },
    ],
  },
);

/* ───────────── B2: DEEPMAW, the Ink Eel ───────────── */
export const deepmaw = mini(
  { id: 'mini_deepmaw', name: 'Deepmaw', blurb: 'Guardian of the Archive: erupts from below in lines.', biome: 2, hp: 540, speed: 200, radius: 32, mass: 10, contact: 0, dmg: 12, art: 'mini_deepmaw', blood: 0x2a6cff, orient: 'none' },
  {
    phases: [0.5],
    idle: 0.7,
    move(e, g) {
      kite(e, g, 160, 300, 120);
      e.facing = toPlayer(e, g).a;
    },
    attacks: [
      {
        id: 'eruptLine',
        weight: 3,
        cd: 2.5,
        start(e, g) {
          e.visual = 1;
          e.untargetable = true;
          const ev = g.events.push(EV.Burrow, e.x, e.y);
          ev.color = 0x2a6cff;
          const p = g.player;
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          const n = e.phase ? 6 : 4;
          for (let i = 0; i < n; i++) {
            const d = 90 + i * 85;
            blastAt(g, e, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 62, 0.7 + i * 0.14, D(e, 1), 0x47d6ff);
          }
          e.tx = e.x + Math.cos(a) * (90 + (n - 1) * 85);
          e.ty = e.y + Math.sin(a) * (90 + (n - 1) * 85);
          e.c = n;
        },
        tick(e, g, dt, t) {
          if (t > 0.7 + e.c * 0.14) {
            const A = g.arena;
            e.x = e.px = clamp(e.tx, A.x0 + e.r, A.x1 - e.r);
            e.y = e.py = clamp(e.ty, A.y0 + e.r, A.y1 - e.r);
            e.visual = 0;
            e.untargetable = false;
            e.data.vuln = 0.4;
            e.data.vulnT = g.time + 1.4;
            return true;
          }
          return false;
        },
      },
      {
        id: 'spit',
        weight: 2.5,
        cd: 2,
        start(e) {
          e.data.windup = 1;
          e.c = 0;
        },
        tick(e, g, dt, t) {
          if (t > 0.45 && !e.c) {
            e.c = 1;
            e.data.windup = 0;
            fan(g, e, toPlayer(e, g).a, e.phase ? 11 : 9, 110 * DEG, 260, D(e, 0.6), 'bullet', 0x2a6cff, PJ.Orb, 10);
          }
          return t > 0.8;
        },
      },
      {
        id: 'pools',
        weight: 1.4,
        cd: 5,
        start(e, g) {
          for (let i = 0; i < 4; i++) {
            const h = addHazard(g, HZ.Ink, TEAM_ENEMY, g.player.x + g.rng.range(-200, 200), g.player.y + g.rng.range(-150, 150), 60, 6, 0, 0x47d6ff, e);
            h.armT = 0.3;
          }
        },
        tick(e, g, dt, t) {
          return t > 0.5;
        },
      },
    ],
  },
  (e) => {
    e.data.vuln = 0.4;
  },
);

/* ───────────── B3: THE FOREMAN ───────────── */
export const foreman = mini(
  { id: 'mini_foreman', name: 'The Foreman', blurb: 'Guardian of the Foundry: armored hammer, rockets and charges.', biome: 3, hp: 560, speed: 90, radius: 34, mass: 14, contact: 0, dmg: 13, art: 'mini_foreman', blood: 0xc8d2e6, orient: 'flip', armor: 160 },
  {
    phases: [0.5],
    idle: 0.8,
    move(e, g) {
      moveTo(e, g, g.player.x, g.player.y, e.armor > 0 ? 80 : 110);
      e.facing = toPlayer(e, g).a;
    },
    onPhase(e) {
      e.armor = e.maxArmor;
    },
    attacks: [
      {
        id: 'hammer',
        weight: 3,
        cd: 2.5,
        range: [0, 260],
        start(e, g) {
          e.tg = tgCircle(g, e, e.x, e.y, 145, 0.8);
        },
        tick(e, g, dt, t) {
          if (t >= 0.8) {
            explode(g, e.x, e.y, 145, D(e, 1), 1, 1, 'other', e);
            addPulse(g, e.x, e.y, 400, 0.7, D(e, 0.7), 0xffb347, e, 26);
            if (e.phase) addPulse(g, e.x, e.y, 400, 1.1, D(e, 0.7), 0xffb347, e, 26);
            return true;
          }
          return false;
        },
      },
      {
        id: 'rockets',
        weight: 2.5,
        cd: 3,
        start(e) {
          e.c = 0;
          e.d = 0;
        },
        tick(e, g, dt, t) {
          e.c -= dt;
          if (e.c <= 0 && e.d < 5) {
            e.c = 0.16;
            e.d++;
            const p = g.player;
            const a = g.rng.range(0, TAU);
            const off = e.d === 1 ? 0 : g.rng.range(50, 180);
            lob(g, e, e.x, e.y - 30, p.x + Math.cos(a) * off, p.y + Math.sin(a) * off, 0.95, 55, D(e, 0.9), 'shell', 0xff7a2a, 220);
          }
          return e.d >= 5 && t > 1.1;
        },
      },
      chargeAttack('ram', 2, 760, 1.2, 1, 0.75),
    ],
  },
);

/* ───────────── B3: THE RIVETERS (tether pair guardians) ───────────── */
const riveterSpec: BossSpec = {
  phases: [],
  idle: 0.6,
  move(e, g) {
    // the pair circles the player on opposite sides, dragging their fence through
    const p = g.player;
    const L = e.link;
    if (L && L.active && L.id < e.id) e.a = L.a + Math.PI;
    else e.a += 0.012 * (e.b || 1);
    const r = 210;
    moveTo(e, g, p.x + Math.cos(e.a) * r, p.y + Math.sin(e.a) * r, 170);
    e.facing = toPlayer(e, g).a;
  },
  attacks: [
    {
      id: 'fan',
      weight: 3,
      cd: 1.6,
      start(e) {
        e.data.windup = 1;
        e.c = 0;
      },
      tick(e, g, dt, t) {
        if (t > 0.45 && !e.c) {
          e.c = 1;
          e.data.windup = 0;
          fan(g, e, toPlayer(e, g).a, 5, 60 * DEG, 330, D(e, 0.6), 'bullet', 0xffb347, PJ.Bullet, 8);
        }
        return t > 0.7;
      },
    },
    {
      id: 'shellburst',
      weight: 1.5,
      cd: 4,
      start(e, g) {
        const p = g.player;
        for (let i = 0; i < 3; i++) lob(g, e, e.x, e.y, p.x + g.rng.range(-120, 120), p.y + g.rng.range(-120, 120), 1 + i * 0.15, 54, D(e, 0.9), 'shell', 0xff7a2a, 200);
      },
      tick(e, g, dt, t) {
        return t > 0.6;
      },
    },
  ],
};
export const riveter: EnemyDef = {
  id: 'mini_riveter',
  name: 'The Riveters',
  blurb: 'Twin guardians bound by a live fence. Kill both.',
  biome: 3,
  roles: ['elite'],
  hp: 300,
  speed: 170,
  radius: 26,
  mass: 10,
  contact: 0,
  dmg: 11,
  art: 'mini_riveter',
  blood: 0xffb347,
  cost: 0,
  noKnock: true,
  staggerImmune: true,
  noElite: true,
  orient: 'flip',
  init(e, g) {
    bossInit(e, g, true);
    e.b = 1;
    for (const o of g.enemies.live) {
      if (o !== e && o.active && o.def.id === 'mini_riveter' && !o.link) {
        o.link = e;
        e.link = o;
        e.a = o.a + Math.PI;
        const h = addHazard(g, HZ.Fence, TEAM_ENEMY, o.x, o.y, 0, 9999, 9 * e.dmgMul, 0xffb347, o);
        h.linkA = o;
        h.linkB = e;
        h.w = 9;
        h.armT = 1;
        return;
      }
    }
  },
  update(e, g, dt) {
    bossUpdate(e, g, dt, riveterSpec);
  },
  onDeath(e) {
    // the survivor enrages
    if (e.link && e.link.active) {
      e.link.speedMul *= 1.35;
      e.link.link = null;
    }
  },
};

/* ───────────── B4: THE ECLIPSED KNIGHT ───────────── */
export const eclipseknight = mini(
  {
    id: 'mini_eclipse',
    name: 'The Eclipsed Knight',
    blurb: 'Guardian of the Crown: parries, star slashes and dashes.',
    biome: 4,
    hp: 620,
    speed: 150,
    radius: 30,
    mass: 10,
    contact: 0,
    dmg: 13,
    art: 'mini_eclipse',
    blood: 0xe8d8ff,
    orient: 'flip',
    onHit(e, g, info) {
      if (e.parry && !info.isDot) {
        e.data.parried = 1;
        const ev = g.events.push(EV.Block, e.x, e.y);
        ev.dx = -info.dirX;
        ev.dy = -info.dirY;
        ev.power = 0.6;
        return true;
      }
      return false;
    },
  },
  {
    phases: [0.5],
    idle: 0.6,
    move(e, g) {
      moveTo(e, g, g.player.x, g.player.y, 140);
      e.facing = toPlayer(e, g).a;
    },
    attacks: [
      {
        id: 'guard',
        weight: 2,
        cd: 5,
        range: [0, 260],
        start(e) {
          e.parry = true;
          e.c = 0;
        },
        tick(e, g, dt, t) {
          if (e.data.parried) {
            // riposte
            e.parry = false;
            if (!e.c) {
              e.c = 1;
              e.tg = tgCone(g, e, toPlayer(e, g).a, 130, 160 * DEG, 0.22);
              e.data.rt = t;
            }
            if (t - e.data.rt >= 0.22) {
              if (playerInArc(e, g, 130, 160 * DEG, e.tg ? e.tg.angle : e.facing)) g.hurtPlayer(D(e, 1.3), e.x, e.y, e);
              e.data.parried = 0;
              return true;
            }
            return false;
          }
          if (t > 1.3) {
            e.parry = false;
            return true;
          }
          return false;
        },
      },
      {
        id: 'starslash',
        weight: 3,
        cd: 2,
        start(e) {
          e.c = 0;
          e.d = 0;
        },
        tick(e, g, dt, t) {
          e.c -= dt;
          const n = e.phase ? 3 : 2;
          if (e.c <= 0 && e.d < n) {
            e.c = 0.4;
            e.d++;
            const pr = fireEnemy(g, e, PJ.Wave, e.x, e.y, toPlayer(e, g).a, 460, D(e, 1), 24, 'regentWave', 0xe8d8ff);
            pr.pierce = 99;
            pr.reflectable = false;
          }
          return e.d >= n && t > n * 0.4;
        },
      },
      chargeAttack('dash3', 2.5, 950, 1.1, 3, 0.45),
    ],
  },
);

/* ───────────── B4: THE VOID MATRON ───────────── */
export const voidmatron = mini(
  { id: 'mini_matron', name: 'The Void Matron', blurb: 'Guardian of the Crown: gravity wells, imps and rings.', biome: 4, hp: 580, speed: 120, radius: 32, mass: 12, contact: 0, dmg: 12, art: 'mini_matron', blood: 0xd45cff, orient: 'flip', flying: true },
  {
    phases: [0.5],
    idle: 0.7,
    move(e, g) {
      kite(e, g, 240, 400, 120);
      e.facing = toPlayer(e, g).a;
    },
    attacks: [
      {
        id: 'wells',
        weight: 2.5,
        cd: 4,
        start(e, g) {
          const p = g.player;
          e.c = 0;
          for (let i = 0; i < 2; i++) {
            const x = p.x + (i ? g.rng.range(-200, 200) : 0);
            const y = p.y + (i ? g.rng.range(-150, 150) : 0);
            e.data['wx' + i] = x;
            e.data['wy' + i] = y;
            const tl = g.telegraph(0, x, y, 0.8, e);
            tl.radius = 52;
            tl.color = 0x9a6cff;
          }
        },
        tick(e, g, dt, t) {
          if (t >= 0.8 && !e.c) {
            e.c = 1;
            for (let i = 0; i < 2; i++) {
              const h = addHazard(g, HZ.Well, TEAM_ENEMY, e.data['wx' + i], e.data['wy' + i], 52, 2.6, D(e, 0.6), 0x9a6cff, e);
              h.b = 200;
            }
          }
          return t > 1;
        },
      },
      {
        id: 'imps',
        weight: 1.5,
        cd: 6,
        start(e) {
          e.data.windup = 1;
        },
        tick(e, g, dt, t) {
          if (t > 0.6) {
            e.data.windup = 0;
            let alive = 0;
            for (const o of g.enemies.live) if (o.active && o.parent === e) alive++;
            if (alive < 5) summon(g, e, voidimp, 4, 120);
            return true;
          }
          return false;
        },
      },
      {
        id: 'rings',
        weight: 3,
        cd: 2.5,
        start(e) {
          e.c = 0;
          e.d = 0;
        },
        tick(e, g, dt, t) {
          e.c -= dt;
          const n = e.phase ? 3 : 2;
          if (e.c <= 0 && e.d < n) {
            e.c = 0.5;
            e.d++;
            ring(g, e, 16, 190 + e.d * 20, D(e, 0.6), e.d * 0.2, toPlayer(e, g).a + Math.PI + e.d * 0.5, 0.32, 'bullet', 0xff7ae0);
          }
          return e.d >= n && t > n * 0.5 + 0.2;
        },
      },
    ],
  },
);

export const MINIBOSSES: EnemyDef[] = [thornback, bloommother, librarian, deepmaw, foreman, riveter, eclipseknight, voidmatron];
export const MINIS_BY_BIOME: EnemyDef[][] = [
  [thornback, bloommother],
  [librarian, deepmaw],
  [foreman, riveter],
  [eclipseknight, voidmatron],
];

export const _u = { blastAt, explode };
